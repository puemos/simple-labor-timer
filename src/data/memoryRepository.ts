import { CONTENT_VERSION } from '@/domain/appConstants';
import { AppRepositoryContract } from '@/data/repositoryContract';
import { shouldStartNewSessionAfterGap } from '@/domain/timing/sessionGrouping';
import { makeId, nowIso, parseIso, visibleEvents } from '@/domain/timing/timeMath';
import {
  AppSnapshot,
  ContractionEvent,
  ContractionSession,
  PregnancyProfile,
  ProviderRule,
  UrgentEvent,
  UrgentType,
} from '@/domain/types';

export class MemoryRepository implements AppRepositoryContract {
  private profile: PregnancyProfile;
  private providerRule: ProviderRule;
  private sessions: ContractionSession[] = [];
  private events: ContractionEvent[] = [];
  private urgentEvents: UrgentEvent[] = [];

  constructor() {
    const now = nowIso();
    this.profile = {
      id: 'profile_default',
      region: 'US',
      emergencyPhone: '911',
      plannedCesarean: false,
      highRiskOrCallEarly: false,
      createdAt: now,
      updatedAt: now,
    };
    this.providerRule = {
      id: 'rule_default_5_1_1',
      profileId: this.profile.id,
      intervalSecondsMax: 5 * 60,
      durationSecondsMin: 60,
      observationWindowMinutes: 60,
      label: '5-1-1',
      actionText: '',
      source: 'app_default',
      createdAt: now,
      updatedAt: now,
    };
  }

  async loadSnapshot(at = nowIso()): Promise<AppSnapshot> {
    this.closeStaleActiveSession(at);
    return this.snapshot(at);
  }

  async startContraction(at = nowIso()): Promise<AppSnapshot> {
    const session = this.ensureSession(at);
    if (!visibleEvents(this.events).some((event) => event.sessionId === session.id && !event.endAt)) {
      this.events.push({
        id: makeId('event'),
        sessionId: session.id,
        startAt: at,
        timezone: currentTimeZone(),
        manuallyEdited: false,
        clockChangeSuspected: false,
        createdAt: at,
        updatedAt: at,
      });
    }
    return this.snapshot(at);
  }

  async endContraction(at = nowIso()): Promise<AppSnapshot> {
    const session = this.getActiveSession();
    const active = session
      ? visibleEvents(this.events).find((event) => event.sessionId === session.id && !event.endAt)
      : undefined;
    if (active) {
      active.endAt = parseIso(at) < parseIso(active.startAt) ? active.startAt : at;
      active.updatedAt = at;
    }
    return this.snapshot(at);
  }

  async undoLastAction(at = nowIso()): Promise<AppSnapshot> {
    const session = this.getActiveSession();
    const latest = session
      ? visibleEvents(this.events)
          .filter((event) => event.sessionId === session.id)
          .sort((a, b) => parseIso(b.updatedAt) - parseIso(a.updatedAt))[0]
      : undefined;
    if (latest) {
      latest.deletedAt = at;
      latest.updatedAt = at;
      latest.manuallyEdited = true;
    }
    return this.snapshot(at);
  }

  async deleteEvent(eventId: string, at = nowIso()): Promise<AppSnapshot> {
    const event = this.events.find((item) => item.id === eventId);
    if (event) {
      event.deletedAt = at;
      event.updatedAt = at;
      event.manuallyEdited = true;
    }
    return this.snapshot(at);
  }

  async restoreLatestDeleted(at = nowIso()): Promise<AppSnapshot> {
    const latest = this.events
      .filter((event) => event.deletedAt)
      .sort((a, b) => parseIso(b.deletedAt!) - parseIso(a.deletedAt!))[0];
    if (latest) {
      latest.deletedAt = undefined;
      latest.updatedAt = at;
      latest.manuallyEdited = true;
    }
    return this.snapshot(at);
  }

  async updateEvent(eventId: string, patch: Partial<Pick<ContractionEvent, 'startAt' | 'endAt' | 'intensity' | 'note'>>, at = nowIso()): Promise<AppSnapshot> {
    const event = this.events.find((item) => item.id === eventId);
    if (event) {
      Object.assign(event, patch, { manuallyEdited: true, updatedAt: at });
      if (event.endAt && parseIso(event.endAt) < parseIso(event.startAt)) {
        event.endAt = event.startAt;
      }
    }
    return this.snapshot(at);
  }

  async addMissedEvent(startAt: string, endAt: string, at = nowIso()): Promise<AppSnapshot> {
    const session = this.ensureSession(startAt);
    this.events.push({
      id: makeId('event'),
      sessionId: session.id,
      startAt,
      endAt,
      timezone: currentTimeZone(),
      manuallyEdited: true,
      clockChangeSuspected: false,
      createdAt: at,
      updatedAt: at,
    });
    return this.snapshot(at);
  }

  async splitEvent(eventId: string, at = nowIso()): Promise<AppSnapshot> {
    const event = this.events.find((item) => item.id === eventId && item.endAt);
    if (event?.endAt) {
      const startMs = parseIso(event.startAt);
      const endMs = parseIso(event.endAt);
      const gapMs = 30_000;
      const firstEnd = new Date(startMs + Math.max(1_000, Math.floor((endMs - startMs - gapMs) / 2))).toISOString();
      const secondStart = new Date(parseIso(firstEnd) + gapMs).toISOString();
      const second = {
        ...event,
        id: makeId('event'),
        startAt: secondStart,
        endAt: event.endAt,
        manuallyEdited: true,
        createdAt: at,
        updatedAt: at,
      };
      event.endAt = firstEnd;
      event.manuallyEdited = true;
      event.updatedAt = at;
      this.events.push(second);
    }
    return this.snapshot(at);
  }

  async mergeWithPrevious(eventId: string, at = nowIso()): Promise<AppSnapshot> {
    const currentEvent = this.events.find((item) => item.id === eventId);
    const ordered = currentEvent
      ? visibleEvents(this.events).filter((event) => event.sessionId === currentEvent.sessionId)
      : [];
    const index = ordered.findIndex((event) => event.id === eventId);
    if (index > 0) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      previous.endAt = current.endAt ?? previous.endAt ?? current.startAt;
      previous.note = [previous.note, current.note].filter(Boolean).join(' / ') || undefined;
      previous.manuallyEdited = true;
      previous.updatedAt = at;
      current.deletedAt = at;
      current.manuallyEdited = true;
      current.updatedAt = at;
    }
    return this.snapshot(at);
  }

  async recordUrgent(type: UrgentType, note?: string, consentToRecord = true, at = nowIso()): Promise<AppSnapshot> {
    const session = this.getActiveSession();
    if (consentToRecord) {
      this.urgentEvents.unshift({
        id: makeId('urgent'),
        sessionId: session?.id,
        type,
        occurredAt: at,
        timezone: currentTimeZone(),
        note,
        sourceIds: ['S4'],
        consentToRecord,
        contentVersion: CONTENT_VERSION,
        createdAt: at,
      });
    }
    return this.snapshot(at);
  }

  async saveProfile(patch: Partial<PregnancyProfile>, at = nowIso()): Promise<AppSnapshot> {
    this.profile = { ...this.profile, ...patch, updatedAt: at };
    return this.snapshot(at);
  }

  async saveProviderRule(patch: Partial<ProviderRule>, at = nowIso()): Promise<AppSnapshot> {
    this.providerRule = { ...this.providerRule, ...patch, updatedAt: at };
    return this.snapshot(at);
  }

  async closeSession(at = nowIso()): Promise<AppSnapshot> {
    const session = this.getActiveSession();
    if (session) {
      Object.assign(session, { status: 'closed' as const, endedAt: at, updatedAt: at });
    }
    return this.snapshot(at);
  }

  async deleteAllData(at = nowIso()): Promise<AppSnapshot> {
    this.sessions = [];
    this.events = [];
    this.urgentEvents = [];
    return this.snapshot(at);
  }

  private ensureSession(startedAt: string): ContractionSession {
    this.closeStaleActiveSession(startedAt);
    const existing = this.getActiveSession();
    if (existing) {
      return existing;
    }
    const session: ContractionSession = {
      id: makeId('session'),
      startedAt,
      status: 'active',
      contentVersion: CONTENT_VERSION,
      createdAt: startedAt,
      updatedAt: startedAt,
    };
    this.sessions.push(session);
    return session;
  }

  private closeStaleActiveSession(at: string): void {
    const session = this.getActiveSession();
    if (!session) {
      return;
    }
    const active = visibleEvents(this.events).some((event) => event.sessionId === session.id && !event.endAt);
    if (active) {
      return;
    }
    const latestEnded = visibleEvents(this.events)
      .filter((event) => event.sessionId === session.id && event.endAt)
      .sort((a, b) => parseIso(b.endAt!) - parseIso(a.endAt!))[0];
    if (shouldStartNewSessionAfterGap(latestEnded, at)) {
      Object.assign(session, { status: 'closed' as const, endedAt: latestEnded.endAt, updatedAt: at });
    }
  }

  private getActiveSession(): ContractionSession | undefined {
    return this.sessions.find((session) => session.status === 'active');
  }

  private snapshot(evaluatedAt: string): AppSnapshot {
    const activeSession = this.getActiveSession();
    const sessions = [...this.sessions].sort((a, b) => parseIso(b.startedAt) - parseIso(a.startedAt));
    const latestSession = sessions[0];
    const allEvents = [...this.events].sort((a, b) => parseIso(a.startAt) - parseIso(b.startAt));
    const allUrgentEvents = [...this.urgentEvents].sort((a, b) => parseIso(b.occurredAt) - parseIso(a.occurredAt));
    return {
      evaluatedAt,
      profile: { ...this.profile },
      providerRule: { ...this.providerRule },
      activeSession: activeSession ? { ...activeSession } : undefined,
      latestSession: latestSession ? { ...latestSession } : undefined,
      sessions: sessions.map((session) => ({ ...session })),
      events: activeSession ? allEvents.filter((event) => event.sessionId === activeSession.id).map(copyEvent) : [],
      allEvents: allEvents.map(copyEvent),
      urgentEvents: activeSession
        ? allUrgentEvents.filter((event) => event.sessionId === activeSession.id).map(copyUrgentEvent)
        : [],
      allUrgentEvents: allUrgentEvents.map(copyUrgentEvent),
    };
  }
}

function copyEvent(event: ContractionEvent): ContractionEvent {
  return { ...event };
}

function copyUrgentEvent(event: UrgentEvent): UrgentEvent {
  return { ...event, sourceIds: [...event.sourceIds] };
}

function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
