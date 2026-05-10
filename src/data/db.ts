import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { CONTENT_VERSION } from '@/domain/appConstants';
import { getOrCreateDatabaseKey } from '@/data/encryptionKey';
import { MemoryRepository } from '@/data/memoryRepository';
import { runMigrations } from '@/data/migrations';
import { AppRepositoryContract } from '@/data/repositoryContract';
import { shouldStartNewSessionAfterGap } from '@/domain/timing/sessionGrouping';
import { makeId, nowIso, parseIso } from '@/domain/timing/timeMath';
import {
  AppSnapshot,
  ContractionEvent,
  ContractionSession,
  Intensity,
  PregnancyProfile,
  ProviderRule,
  UrgentEvent,
  UrgentType,
} from '@/domain/types';

type ProfileRow = {
  id: string;
  estimated_due_date?: string;
  gestational_age_at_setup_days?: number;
  region: PregnancyProfile['region'];
  care_team_phone?: string;
  birth_location_phone?: string;
  doula_name?: string;
  doula_phone?: string;
  emergency_phone: string;
  planned_cesarean: number;
  high_risk_or_call_early: number;
  created_at: string;
  updated_at: string;
};

type RuleRow = {
  id: string;
  profile_id: string;
  interval_seconds_max: number;
  duration_seconds_min: number;
  observation_window_minutes: number;
  label: string;
  action_text: string;
  source: ProviderRule['source'];
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  started_at: string;
  ended_at?: string;
  status: ContractionSession['status'];
  content_version: string;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  session_id: string;
  start_at: string;
  end_at?: string;
  timezone: string;
  intensity?: Intensity;
  note?: string;
  manually_edited: number;
  clock_change_suspected: number;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
};

type UrgentRow = {
  id: string;
  session_id?: string;
  type: UrgentType;
  occurred_at: string;
  timezone: string;
  note?: string;
  source_ids_json: string;
  consent_to_record: number;
  content_version: string;
  created_at: string;
};

const DEFAULT_PROFILE_ID = 'profile_default';
const DEFAULT_RULE_ID = 'rule_default_5_1_1';

let repositoryPromise: Promise<AppRepositoryContract> | undefined;

export async function getAppRepository(): Promise<AppRepositoryContract> {
  repositoryPromise ??= Platform.OS === 'web' ? Promise.resolve(new MemoryRepository()) : AppRepository.open();
  return repositoryPromise;
}

export class AppRepository implements AppRepositoryContract {
  private constructor(private readonly db: SQLite.SQLiteDatabase) {}

  static async open(): Promise<AppRepository> {
    const db = await SQLite.openDatabaseAsync('itiscoming.db');
    const key = await getOrCreateDatabaseKey();
    await db.execAsync(`PRAGMA key = '${key.replaceAll("'", "''")}';`);
    await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    await runMigrations(db);
    const repo = new AppRepository(db);
    await repo.seedDefaults();
    return repo;
  }

  async loadSnapshot(at = nowIso()): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      await this.closeStaleActiveSession(at);
    });
    const profile = await this.getProfile();
    const providerRule = await this.getProviderRule(profile.id);
    const activeSession = await this.getActiveSession();
    const sessions = await this.getSessions();
    const latestSession = sessions[0];
    const allEvents = await this.getAllEvents();
    const allUrgentEvents = await this.getAllUrgentEvents();
    return {
      profile,
      providerRule,
      activeSession,
      latestSession,
      sessions,
      events: activeSession ? allEvents.filter((event) => event.sessionId === activeSession.id) : [],
      allEvents,
      urgentEvents: activeSession ? allUrgentEvents.filter((event) => event.sessionId === activeSession.id) : [],
      allUrgentEvents,
    };
  }

  async startContraction(at = nowIso()): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      const session = await this.ensureActiveSession(at);
      const existing = await this.db.getFirstAsync<EventRow>(
        'SELECT * FROM contraction_events WHERE session_id = ? AND end_at IS NULL AND deleted_at IS NULL LIMIT 1',
        session.id,
      );
      if (existing) {
        return;
      }
      const event: ContractionEvent = {
        id: makeId('event'),
        sessionId: session.id,
        startAt: at,
        timezone: currentTimeZone(),
        manuallyEdited: false,
        clockChangeSuspected: false,
        createdAt: at,
        updatedAt: at,
      };
      await this.db.runAsync(
        `INSERT INTO contraction_events
          (id, session_id, start_at, timezone, manually_edited, clock_change_suspected, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        event.id,
        event.sessionId,
        event.startAt,
        event.timezone,
        0,
        0,
        event.createdAt,
        event.updatedAt,
      );
      await this.writeRevision('contraction_event', event.id, 'start_contraction', undefined, event, 'timer_start', at);
    });
    return this.loadSnapshot(at);
  }

  async endContraction(at = nowIso()): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      const session = await this.getActiveSession();
      if (!session) {
        return;
      }
      const row = await this.db.getFirstAsync<EventRow>(
        'SELECT * FROM contraction_events WHERE session_id = ? AND end_at IS NULL AND deleted_at IS NULL ORDER BY start_at DESC LIMIT 1',
        session.id,
      );
      if (!row) {
        return;
      }
      const before = rowToEvent(row);
      const endAt = parseIso(at) < parseIso(before.startAt) ? before.startAt : at;
      await this.db.runAsync('UPDATE contraction_events SET end_at = ?, updated_at = ? WHERE id = ?', endAt, at, before.id);
      await this.writeRevision(
        'contraction_event',
        before.id,
        'end_contraction',
        before,
        { ...before, endAt, updatedAt: at },
        'timer_end',
        at,
      );
    });
    return this.loadSnapshot(at);
  }

  async undoLastAction(at = nowIso()): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      const session = await this.getActiveSession();
      if (!session) {
        return;
      }
      const row = await this.db.getFirstAsync<EventRow>(
        `SELECT * FROM contraction_events
         WHERE session_id = ? AND deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT 1`,
        session.id,
      );
      if (!row) {
        return;
      }
      const before = rowToEvent(row);
      await this.db.runAsync('UPDATE contraction_events SET deleted_at = ?, updated_at = ?, manually_edited = 1 WHERE id = ?', at, at, before.id);
      await this.writeRevision(
        'contraction_event',
        before.id,
        'soft_delete_event',
        before,
        { ...before, deletedAt: at, updatedAt: at, manuallyEdited: true },
        'undo',
        at,
      );
    });
    return this.loadSnapshot(at);
  }

  async deleteEvent(eventId: string, at = nowIso()): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      const row = await this.db.getFirstAsync<EventRow>('SELECT * FROM contraction_events WHERE id = ?', eventId);
      if (!row) {
        return;
      }
      const before = rowToEvent(row);
      await this.db.runAsync('UPDATE contraction_events SET deleted_at = ?, updated_at = ?, manually_edited = 1 WHERE id = ?', at, at, eventId);
      await this.writeRevision(
        'contraction_event',
        eventId,
        'soft_delete_event',
        before,
        { ...before, deletedAt: at, updatedAt: at, manuallyEdited: true },
        'delete_event',
        at,
      );
    });
    return this.loadSnapshot(at);
  }

  async restoreLatestDeleted(at = nowIso()): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      const row = await this.db.getFirstAsync<EventRow>(
        `SELECT * FROM contraction_events
         WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC LIMIT 1`,
      );
      if (!row) {
        return;
      }
      const before = rowToEvent(row);
      await this.db.runAsync('UPDATE contraction_events SET deleted_at = NULL, updated_at = ?, manually_edited = 1 WHERE id = ?', at, before.id);
      await this.writeRevision(
        'contraction_event',
        before.id,
        'restore_event',
        before,
        { ...before, deletedAt: undefined, updatedAt: at, manuallyEdited: true },
        'restore',
        at,
      );
    });
    return this.loadSnapshot(at);
  }

  async updateEvent(
    eventId: string,
    patch: Partial<Pick<ContractionEvent, 'startAt' | 'endAt' | 'intensity' | 'note'>>,
    at = nowIso(),
  ): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      const row = await this.db.getFirstAsync<EventRow>('SELECT * FROM contraction_events WHERE id = ?', eventId);
      if (!row) {
        return;
      }
      const before = rowToEvent(row);
      const startAt = patch.startAt ?? before.startAt;
      const endAt = patch.endAt === '' ? undefined : patch.endAt ?? before.endAt;
      const safeEndAt = endAt && parseIso(endAt) < parseIso(startAt) ? startAt : endAt;
      const after = {
        ...before,
        startAt,
        endAt: safeEndAt,
        intensity: patch.intensity ?? before.intensity,
        note: patch.note ?? before.note,
        manuallyEdited: true,
        updatedAt: at,
      };
      await this.db.runAsync(
        `UPDATE contraction_events
         SET start_at = ?, end_at = ?, intensity = ?, note = ?, manually_edited = 1, updated_at = ?
         WHERE id = ?`,
        after.startAt,
        after.endAt ?? null,
        after.intensity ?? null,
        after.note ?? null,
        at,
        eventId,
      );
      await this.writeRevision('contraction_event', eventId, 'edit_event', before, after, 'manual_edit', at);
    });
    return this.loadSnapshot(at);
  }

  async addMissedEvent(startAt: string, endAt: string, at = nowIso()): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      const session = await this.ensureActiveSession(startAt);
      const event: ContractionEvent = {
        id: makeId('event'),
        sessionId: session.id,
        startAt,
        endAt,
        timezone: currentTimeZone(),
        manuallyEdited: true,
        clockChangeSuspected: false,
        createdAt: at,
        updatedAt: at,
      };
      await this.db.runAsync(
        `INSERT INTO contraction_events
          (id, session_id, start_at, end_at, timezone, manually_edited, clock_change_suspected, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        event.id,
        event.sessionId,
        event.startAt,
        event.endAt ?? null,
        event.timezone,
        1,
        0,
        event.createdAt,
        event.updatedAt,
      );
      await this.writeRevision('contraction_event', event.id, 'add_missed_event', undefined, event, 'manual_add', at);
    });
    return this.loadSnapshot(at);
  }

  async splitEvent(eventId: string, at = nowIso()): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      const row = await this.db.getFirstAsync<EventRow>('SELECT * FROM contraction_events WHERE id = ? AND end_at IS NOT NULL', eventId);
      if (!row?.end_at) {
        return;
      }
      const before = rowToEvent(row);
      const startMs = parseIso(before.startAt);
      const endMs = parseIso(before.endAt!);
      const durationMs = Math.max(1_000, endMs - startMs);
      const gapMs = Math.min(30_000, Math.floor(durationMs / 6));
      const firstEnd = new Date(startMs + Math.floor((durationMs - gapMs) / 2)).toISOString();
      const secondStart = new Date(parseIso(firstEnd) + gapMs).toISOString();
      const second: ContractionEvent = {
        ...before,
        id: makeId('event'),
        startAt: secondStart,
        endAt: before.endAt,
        manuallyEdited: true,
        createdAt: at,
        updatedAt: at,
      };
      await this.db.runAsync(
        'UPDATE contraction_events SET end_at = ?, manually_edited = 1, updated_at = ? WHERE id = ?',
        firstEnd,
        at,
        before.id,
      );
      await this.db.runAsync(
        `INSERT INTO contraction_events
          (id, session_id, start_at, end_at, timezone, intensity, note, manually_edited, clock_change_suspected, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        second.id,
        second.sessionId,
        second.startAt,
        second.endAt ?? null,
        second.timezone,
        second.intensity ?? null,
        second.note ?? null,
        1,
        second.clockChangeSuspected ? 1 : 0,
        at,
        at,
      );
      await this.writeRevision(
        'contraction_event',
        before.id,
        'split_event',
        before,
        { firstEnd, second },
        'split_event',
        at,
      );
    });
    return this.loadSnapshot(at);
  }

  async mergeWithPrevious(eventId: string, at = nowIso()): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      const currentRow = await this.db.getFirstAsync<EventRow>('SELECT * FROM contraction_events WHERE id = ?', eventId);
      if (!currentRow) {
        return;
      }
      const current = rowToEvent(currentRow);
      const previousRow = await this.db.getFirstAsync<EventRow>(
        `SELECT * FROM contraction_events
         WHERE session_id = ? AND deleted_at IS NULL AND start_at < ?
         ORDER BY start_at DESC LIMIT 1`,
        current.sessionId,
        current.startAt,
      );
      if (!previousRow) {
        return;
      }
      const previous = rowToEvent(previousRow);
      const mergedNote = [previous.note, current.note].filter(Boolean).join(' / ') || undefined;
      await this.db.runAsync(
        'UPDATE contraction_events SET end_at = ?, note = ?, manually_edited = 1, updated_at = ? WHERE id = ?',
        current.endAt ?? previous.endAt ?? current.startAt,
        mergedNote ?? null,
        at,
        previous.id,
      );
      await this.db.runAsync('UPDATE contraction_events SET deleted_at = ?, manually_edited = 1, updated_at = ? WHERE id = ?', at, at, current.id);
      await this.writeRevision('contraction_event', previous.id, 'merge_events', { previous, current }, { previousId: previous.id }, 'merge', at);
    });
    return this.loadSnapshot(at);
  }

  async recordUrgent(type: UrgentType, note?: string, consentToRecord = true, at = nowIso()): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      const session = await this.getActiveSession();
      const event: UrgentEvent = {
        id: makeId('urgent'),
        sessionId: session?.id,
        type,
        occurredAt: at,
        timezone: currentTimeZone(),
        note,
        sourceIds: urgentSources(type),
        consentToRecord,
        contentVersion: CONTENT_VERSION,
        createdAt: at,
      };
      if (!consentToRecord) {
        return;
      }
      await this.db.runAsync(
        `INSERT INTO urgent_events
          (id, session_id, type, occurred_at, timezone, note, source_ids_json, consent_to_record, content_version, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        event.id,
        event.sessionId ?? null,
        event.type,
        event.occurredAt,
        event.timezone,
        event.note ?? null,
        JSON.stringify(event.sourceIds),
        event.consentToRecord ? 1 : 0,
        event.contentVersion,
        event.createdAt,
      );
      await this.writeRevision('urgent_event', event.id, 'record_urgent_event', undefined, event, 'urgent', at);
    });
    return this.loadSnapshot(at);
  }

  async saveProfile(patch: Partial<PregnancyProfile>, at = nowIso()): Promise<AppSnapshot> {
    const before = await this.getProfile();
    const after = { ...before, ...patch, updatedAt: at };
    await this.db.runAsync(
      `UPDATE pregnancy_profiles
       SET estimated_due_date = ?, gestational_age_at_setup_days = ?, region = ?, care_team_phone = ?,
           birth_location_phone = ?, doula_name = ?, doula_phone = ?, emergency_phone = ?,
           planned_cesarean = ?, high_risk_or_call_early = ?, updated_at = ?
       WHERE id = ?`,
      after.estimatedDueDate ?? null,
      after.gestationalAgeAtSetupDays ?? null,
      after.region,
      after.careTeamPhone ?? null,
      after.birthLocationPhone ?? null,
      after.doulaName ?? null,
      after.doulaPhone ?? null,
      after.emergencyPhone,
      after.plannedCesarean ? 1 : 0,
      after.highRiskOrCallEarly ? 1 : 0,
      at,
      after.id,
    );
    await this.writeRevision('pregnancy_profile', after.id, 'update_profile', before, after, 'settings', at);
    return this.loadSnapshot(at);
  }

  async saveProviderRule(patch: Partial<ProviderRule>, at = nowIso()): Promise<AppSnapshot> {
    const profile = await this.getProfile();
    const existing = await this.getProviderRule(profile.id);
    const next: ProviderRule = {
      id: existing?.id ?? makeId('rule'),
      profileId: profile.id,
      intervalSecondsMax: patch.intervalSecondsMax ?? existing?.intervalSecondsMax ?? 5 * 60,
      durationSecondsMin: patch.durationSecondsMin ?? existing?.durationSecondsMin ?? 60,
      observationWindowMinutes: patch.observationWindowMinutes ?? existing?.observationWindowMinutes ?? 60,
      label: patch.label ?? existing?.label ?? 'Custom',
      actionText: patch.actionText ?? existing?.actionText ?? 'Call your care team',
      source: patch.source ?? 'user_provider',
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
    };
    await this.db.runAsync(
      `INSERT OR REPLACE INTO provider_rules
       (id, profile_id, interval_seconds_max, duration_seconds_min, observation_window_minutes, label, action_text, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      next.id,
      next.profileId,
      next.intervalSecondsMax,
      next.durationSecondsMin,
      next.observationWindowMinutes,
      next.label,
      next.actionText,
      next.source,
      next.createdAt,
      next.updatedAt,
    );
    await this.writeRevision('provider_rule', next.id, 'update_provider_rule', existing, next, 'settings', at);
    return this.loadSnapshot(at);
  }

  async closeSession(at = nowIso()): Promise<AppSnapshot> {
    const session = await this.getActiveSession();
    if (session) {
      await this.db.runAsync('UPDATE sessions SET status = ?, ended_at = ?, updated_at = ? WHERE id = ?', 'closed', at, at, session.id);
      await this.writeRevision('session', session.id, 'close_session', session, { ...session, status: 'closed', endedAt: at }, 'close', at);
    }
    return this.loadSnapshot(at);
  }

  async deleteAllData(at = nowIso()): Promise<AppSnapshot> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM urgent_events');
      await this.db.runAsync('DELETE FROM contraction_events');
      await this.db.runAsync('DELETE FROM sessions');
      await this.db.runAsync('DELETE FROM event_revisions');
      await this.writeRevision('app', 'all_data', 'delete_all_data', undefined, { deletedAt: at }, 'privacy_delete', at);
    });
    return this.loadSnapshot(at);
  }

  private async seedDefaults(): Promise<void> {
    const now = nowIso();
    const profile = await this.db.getFirstAsync<ProfileRow>('SELECT * FROM pregnancy_profiles WHERE id = ?', DEFAULT_PROFILE_ID);
    if (!profile) {
      await this.db.runAsync(
        `INSERT INTO pregnancy_profiles
          (id, region, emergency_phone, planned_cesarean, high_risk_or_call_early, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        DEFAULT_PROFILE_ID,
        'US',
        '911',
        0,
        0,
        now,
        now,
      );
    }
    const rule = await this.db.getFirstAsync<RuleRow>('SELECT * FROM provider_rules WHERE id = ?', DEFAULT_RULE_ID);
    if (!rule) {
      await this.db.runAsync(
        `INSERT INTO provider_rules
          (id, profile_id, interval_seconds_max, duration_seconds_min, observation_window_minutes, label, action_text, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        DEFAULT_RULE_ID,
        DEFAULT_PROFILE_ID,
        5 * 60,
        60,
        60,
        '5-1-1',
        'Call your care team',
        'app_default',
        now,
        now,
      );
    }
  }

  private async ensureActiveSession(startedAt: string): Promise<ContractionSession> {
    await this.closeStaleActiveSession(startedAt);
    const existing = await this.getActiveSession();
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
    await this.db.runAsync(
      `INSERT INTO sessions (id, started_at, status, content_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      session.id,
      session.startedAt,
      session.status,
      session.contentVersion,
      session.createdAt,
      session.updatedAt,
    );
    await this.writeRevision('session', session.id, 'start_session', undefined, session, 'auto_start', startedAt);
    return session;
  }

  private async closeStaleActiveSession(at: string): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) {
      return;
    }
    const activeEvent = await this.db.getFirstAsync<EventRow>(
      'SELECT * FROM contraction_events WHERE session_id = ? AND end_at IS NULL AND deleted_at IS NULL LIMIT 1',
      session.id,
    );
    if (activeEvent) {
      return;
    }
    const latestEnded = await this.db.getFirstAsync<EventRow>(
      `SELECT * FROM contraction_events
       WHERE session_id = ? AND end_at IS NOT NULL AND deleted_at IS NULL
       ORDER BY end_at DESC LIMIT 1`,
      session.id,
    );
    if (!shouldStartNewSessionAfterGap(latestEnded ? rowToEvent(latestEnded) : undefined, at)) {
      return;
    }
    const endedAt = latestEnded!.end_at!;
    const after: ContractionSession = { ...session, status: 'closed', endedAt, updatedAt: at };
    await this.db.runAsync('UPDATE sessions SET status = ?, ended_at = ?, updated_at = ? WHERE id = ?', 'closed', endedAt, at, session.id);
    await this.writeRevision('session', session.id, 'auto_close_session', session, after, 'auto_inactivity', at);
  }

  private async getProfile(): Promise<PregnancyProfile> {
    const row = await this.db.getFirstAsync<ProfileRow>('SELECT * FROM pregnancy_profiles WHERE id = ?', DEFAULT_PROFILE_ID);
    if (!row) {
      throw new Error('Default profile was not initialized.');
    }
    return rowToProfile(row);
  }

  private async getProviderRule(profileId: string): Promise<ProviderRule | undefined> {
    const row = await this.db.getFirstAsync<RuleRow>(
      'SELECT * FROM provider_rules WHERE profile_id = ? ORDER BY updated_at DESC LIMIT 1',
      profileId,
    );
    return row ? rowToRule(row) : undefined;
  }

  private async getActiveSession(): Promise<ContractionSession | undefined> {
    const row = await this.db.getFirstAsync<SessionRow>(
      'SELECT * FROM sessions WHERE status = ? ORDER BY started_at DESC LIMIT 1',
      'active',
    );
    return row ? rowToSession(row) : undefined;
  }

  private async getSessions(): Promise<ContractionSession[]> {
    const rows = await this.db.getAllAsync<SessionRow>('SELECT * FROM sessions ORDER BY started_at DESC');
    return rows.map(rowToSession);
  }

  private async getEvents(sessionId: string, includeDeleted = false): Promise<ContractionEvent[]> {
    const rows = await this.db.getAllAsync<EventRow>(
      `SELECT * FROM contraction_events WHERE session_id = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'} ORDER BY start_at ASC`,
      sessionId,
    );
    return rows.map(rowToEvent);
  }

  private async getAllEvents(): Promise<ContractionEvent[]> {
    const rows = await this.db.getAllAsync<EventRow>('SELECT * FROM contraction_events ORDER BY start_at ASC');
    return rows.map(rowToEvent);
  }

  private async getUrgentEvents(sessionId?: string): Promise<UrgentEvent[]> {
    const rows = sessionId
      ? await this.db.getAllAsync<UrgentRow>('SELECT * FROM urgent_events WHERE session_id = ? ORDER BY occurred_at DESC', sessionId)
      : await this.db.getAllAsync<UrgentRow>('SELECT * FROM urgent_events ORDER BY occurred_at DESC LIMIT 20');
    return rows.map(rowToUrgent);
  }

  private async getAllUrgentEvents(): Promise<UrgentEvent[]> {
    const rows = await this.db.getAllAsync<UrgentRow>('SELECT * FROM urgent_events ORDER BY occurred_at DESC');
    return rows.map(rowToUrgent);
  }

  private async writeRevision(
    entityType: string,
    entityId: string,
    operation: string,
    before: unknown,
    after: unknown,
    reason: string,
    createdAt: string,
  ): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO event_revisions
       (id, entity_type, entity_id, operation, before_json, after_json, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      makeId('revision'),
      entityType,
      entityId,
      operation,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      reason,
      createdAt,
    );
  }
}

function rowToProfile(row: ProfileRow): PregnancyProfile {
  return {
    id: row.id,
    estimatedDueDate: row.estimated_due_date ?? undefined,
    gestationalAgeAtSetupDays: row.gestational_age_at_setup_days ?? undefined,
    region: row.region,
    careTeamPhone: row.care_team_phone ?? undefined,
    birthLocationPhone: row.birth_location_phone ?? undefined,
    doulaName: row.doula_name ?? undefined,
    doulaPhone: row.doula_phone ?? undefined,
    emergencyPhone: row.emergency_phone,
    plannedCesarean: Boolean(row.planned_cesarean),
    highRiskOrCallEarly: Boolean(row.high_risk_or_call_early),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRule(row: RuleRow): ProviderRule {
  return {
    id: row.id,
    profileId: row.profile_id,
    intervalSecondsMax: row.interval_seconds_max,
    durationSecondsMin: row.duration_seconds_min,
    observationWindowMinutes: row.observation_window_minutes,
    label: row.label,
    actionText: row.action_text,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSession(row: SessionRow): ContractionSession {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    status: row.status,
    contentVersion: row.content_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEvent(row: EventRow): ContractionEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    startAt: row.start_at,
    endAt: row.end_at ?? undefined,
    timezone: row.timezone,
    intensity: row.intensity ?? undefined,
    note: row.note ?? undefined,
    manuallyEdited: Boolean(row.manually_edited),
    clockChangeSuspected: Boolean(row.clock_change_suspected),
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToUrgent(row: UrgentRow): UrgentEvent {
  return {
    id: row.id,
    sessionId: row.session_id ?? undefined,
    type: row.type,
    occurredAt: row.occurred_at,
    timezone: row.timezone,
    note: row.note ?? undefined,
    sourceIds: JSON.parse(row.source_ids_json) as string[],
    consentToRecord: Boolean(row.consent_to_record),
    contentVersion: row.content_version,
    createdAt: row.created_at,
  };
}

function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function urgentSources(type: UrgentType): string[] {
  switch (type) {
    case 'under_37_weeks_labor_concern':
      return ['S3', 'S4'];
    case 'contraction_over_2_min':
    case 'water_broke':
    case 'vaginal_bleeding':
    case 'reduced_fetal_movement':
    case 'planned_c_section_or_call_early':
      return ['S4'];
    case 'severe_or_unusual_pain':
    case 'fever_unwell':
      return ['S4'];
  }
}
