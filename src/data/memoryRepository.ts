import { CONTENT_VERSION } from '@/domain/appConstants';
import { AppRepositoryContract } from '@/data/repositoryContract';
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
  private activeSession?: ContractionSession;
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
      actionText: 'Call your care team',
      source: 'app_default',
      createdAt: now,
      updatedAt: now,
    };
  }

  async loadSnapshot(): Promise<AppSnapshot> {
    return this.snapshot();
  }

  async startContraction(at = nowIso()): Promise<AppSnapshot> {
    const session = this.ensureSession(at);
    if (!visibleEvents(this.events).some((event) => !event.endAt)) {
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
    return this.snapshot();
  }

  async endContraction(at = nowIso()): Promise<AppSnapshot> {
    const active = visibleEvents(this.events).find((event) => !event.endAt);
    if (active) {
      active.endAt = parseIso(at) < parseIso(active.startAt) ? active.startAt : at;
      active.updatedAt = at;
    }
    return this.snapshot();
  }

  async undoLastAction(at = nowIso()): Promise<AppSnapshot> {
    const latest = visibleEvents(this.events).sort((a, b) => parseIso(b.updatedAt) - parseIso(a.updatedAt))[0];
    if (latest) {
      latest.deletedAt = at;
      latest.updatedAt = at;
      latest.manuallyEdited = true;
    }
    return this.snapshot();
  }

  async deleteEvent(eventId: string, at = nowIso()): Promise<AppSnapshot> {
    const event = this.events.find((item) => item.id === eventId);
    if (event) {
      event.deletedAt = at;
      event.updatedAt = at;
      event.manuallyEdited = true;
    }
    return this.snapshot();
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
    return this.snapshot();
  }

  async updateEvent(eventId: string, patch: Partial<Pick<ContractionEvent, 'startAt' | 'endAt' | 'intensity' | 'note'>>, at = nowIso()): Promise<AppSnapshot> {
    const event = this.events.find((item) => item.id === eventId);
    if (event) {
      Object.assign(event, patch, { manuallyEdited: true, updatedAt: at });
      if (event.endAt && parseIso(event.endAt) < parseIso(event.startAt)) {
        event.endAt = event.startAt;
      }
    }
    return this.snapshot();
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
    return this.snapshot();
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
    return this.snapshot();
  }

  async mergeWithPrevious(eventId: string, at = nowIso()): Promise<AppSnapshot> {
    const ordered = visibleEvents(this.events);
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
    return this.snapshot();
  }

  async recordUrgent(type: UrgentType, note?: string, consentToRecord = true, at = nowIso()): Promise<AppSnapshot> {
    if (consentToRecord) {
      this.urgentEvents.unshift({
        id: makeId('urgent'),
        sessionId: this.activeSession?.id,
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
    return this.snapshot();
  }

  async saveProfile(patch: Partial<PregnancyProfile>, at = nowIso()): Promise<AppSnapshot> {
    this.profile = { ...this.profile, ...patch, updatedAt: at };
    return this.snapshot();
  }

  async saveProviderRule(patch: Partial<ProviderRule>, at = nowIso()): Promise<AppSnapshot> {
    this.providerRule = { ...this.providerRule, ...patch, updatedAt: at };
    return this.snapshot();
  }

  async closeSession(at = nowIso()): Promise<AppSnapshot> {
    if (this.activeSession) {
      this.activeSession = { ...this.activeSession, status: 'closed', endedAt: at, updatedAt: at };
    }
    return this.snapshot();
  }

  async deleteAllData(): Promise<AppSnapshot> {
    this.activeSession = undefined;
    this.events = [];
    this.urgentEvents = [];
    return this.snapshot();
  }

  private ensureSession(startedAt: string): ContractionSession {
    if (!this.activeSession || this.activeSession.status !== 'active') {
      this.activeSession = {
        id: makeId('session'),
        startedAt,
        status: 'active',
        contentVersion: CONTENT_VERSION,
        createdAt: startedAt,
        updatedAt: startedAt,
      };
    }
    return this.activeSession;
  }

  private snapshot(): AppSnapshot {
    return {
      profile: { ...this.profile },
      providerRule: { ...this.providerRule },
      activeSession: this.activeSession ? { ...this.activeSession } : undefined,
      events: this.events.map((event) => ({ ...event })),
      urgentEvents: this.urgentEvents.map((event) => ({ ...event, sourceIds: [...event.sourceIds] })),
    };
  }
}

function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
