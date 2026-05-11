import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { buildSummaryText } from '@/domain/export/summaryText';
import { evaluateProviderRule } from '@/domain/rules/providerRule';
import { evaluateUrgentRules } from '@/domain/rules/urgentRules';
import { shouldStartNewSessionAfterGap } from '@/domain/timing/sessionGrouping';
import { computeSessionSummary } from '@/domain/timing/summaries';
import { endedEvents } from '@/domain/timing/timeMath';
import { AppSnapshot, ContractionEvent, PregnancyProfile, ProviderRule, UrgentType } from '@/domain/types';
import { getAppRepository } from '@/data/db';
import { useAppLanguage, useAppTranslation } from '@/i18n';
import { hapticEnd, hapticStart, hapticWarning } from '@/native/haptics';
import { useClock } from '@/state/useClock';

type EventPatch = Partial<Pick<ContractionEvent, 'startAt' | 'endAt' | 'intensity' | 'note'>>;
type AppErrorKey = 'errors.generic' | 'errors.databaseOpen' | 'errors.databaseRefresh';

type ContractionState = {
  loading: boolean;
  busy: boolean;
  error?: string;
  errorKey?: AppErrorKey;
  snapshot?: AppSnapshot;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  start: () => Promise<void>;
  end: () => Promise<void>;
  undo: () => Promise<void>;
  restore: () => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  updateEvent: (eventId: string, patch: EventPatch) => Promise<void>;
  addMissedEvent: (startAt: string, endAt: string) => Promise<void>;
  splitEvent: (eventId: string) => Promise<void>;
  mergeWithPrevious: (eventId: string) => Promise<void>;
  recordUrgent: (type: UrgentType, note?: string, consent?: boolean) => Promise<void>;
  saveProfile: (patch: Partial<PregnancyProfile>) => Promise<void>;
  saveProviderRule: (patch: Partial<ProviderRule>) => Promise<void>;
  closeSession: () => Promise<void>;
  deleteAllData: () => Promise<void>;
};

async function runRepositoryAction(
  set: (patch: Partial<ContractionState>) => void,
  action: () => Promise<AppSnapshot>,
) {
  set({ busy: true, error: undefined, errorKey: undefined });
  try {
    const snapshot = await action();
    set({ snapshot, busy: false });
  } catch (caught) {
    set({
      busy: false,
      error: caught instanceof Error ? caught.message : undefined,
      errorKey: caught instanceof Error ? undefined : 'errors.generic',
    });
  }
}

export const useContractionStore = create<ContractionState>((set) => ({
  loading: true,
  busy: false,
  hydrate: async () => {
    set({ loading: true, error: undefined, errorKey: undefined });
    try {
      const repo = await getAppRepository();
      set({ snapshot: await repo.loadSnapshot(), loading: false });
    } catch (caught) {
      set({
        loading: false,
        error: caught instanceof Error ? caught.message : undefined,
        errorKey: caught instanceof Error ? undefined : 'errors.databaseOpen',
      });
    }
  },
  refresh: async () => {
    try {
      const repo = await getAppRepository();
      set({ snapshot: await repo.loadSnapshot(), error: undefined, errorKey: undefined });
    } catch (caught) {
      set({
        error: caught instanceof Error ? caught.message : undefined,
        errorKey: caught instanceof Error ? undefined : 'errors.databaseRefresh',
      });
    }
  },
  start: async () => {
    await hapticStart();
    await runRepositoryAction(set, async () => (await getAppRepository()).startContraction());
  },
  end: async () => {
    await hapticEnd();
    await runRepositoryAction(set, async () => (await getAppRepository()).endContraction());
  },
  undo: async () => runRepositoryAction(set, async () => (await getAppRepository()).undoLastAction()),
  restore: async () => runRepositoryAction(set, async () => (await getAppRepository()).restoreLatestDeleted()),
  deleteEvent: async (eventId) => runRepositoryAction(set, async () => (await getAppRepository()).deleteEvent(eventId)),
  updateEvent: async (eventId, patch) => runRepositoryAction(set, async () => (await getAppRepository()).updateEvent(eventId, patch)),
  addMissedEvent: async (startAt, endAt) => runRepositoryAction(set, async () => (await getAppRepository()).addMissedEvent(startAt, endAt)),
  splitEvent: async (eventId) => runRepositoryAction(set, async () => (await getAppRepository()).splitEvent(eventId)),
  mergeWithPrevious: async (eventId) => runRepositoryAction(set, async () => (await getAppRepository()).mergeWithPrevious(eventId)),
  recordUrgent: async (type, note, consent = true) =>
    runRepositoryAction(set, async () => (await getAppRepository()).recordUrgent(type, note, consent)),
  saveProfile: async (patch) => runRepositoryAction(set, async () => (await getAppRepository()).saveProfile(patch)),
  saveProviderRule: async (patch) => runRepositoryAction(set, async () => (await getAppRepository()).saveProviderRule(patch)),
  closeSession: async () => runRepositoryAction(set, async () => (await getAppRepository()).closeSession()),
  deleteAllData: async () => runRepositoryAction(set, async () => (await getAppRepository()).deleteAllData()),
}));

export function useContractionBootstrap() {
  const hydrate = useContractionStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}

export function useContractionApp() {
  const { t } = useAppTranslation();
  const { locale } = useAppLanguage();
  const loading = useContractionStore((state) => state.loading);
  const busy = useContractionStore((state) => state.busy);
  const rawError = useContractionStore((state) => state.error);
  const errorKey = useContractionStore((state) => state.errorKey);
  const error = rawError ?? (errorKey ? t(errorKey) : undefined);
  const snapshot = useContractionStore((state) => state.snapshot);
  const activeSessionId = snapshot?.activeSession?.id;
  const hasActiveSession = Boolean(activeSessionId);
  const refresh = useContractionStore((state) => state.refresh);
  const actions = useContractionStore(
    useShallow((state) => ({
      reload: state.hydrate,
      start: state.start,
      end: state.end,
      undo: state.undo,
      restore: state.restore,
      deleteEvent: state.deleteEvent,
      updateEvent: state.updateEvent,
      addMissedEvent: state.addMissedEvent,
      splitEvent: state.splitEvent,
      mergeWithPrevious: state.mergeWithPrevious,
      recordUrgent: state.recordUrgent,
      saveProfile: state.saveProfile,
      saveProviderRule: state.saveProviderRule,
      closeSession: state.closeSession,
      deleteAllData: state.deleteAllData,
    })),
  );

  const now = useClock(hasActiveSession);
  const evaluatedAt = snapshot?.evaluatedAt ?? now;

  const summary = useMemo(
    () => computeSessionSummary(snapshot?.events ?? [], evaluatedAt, snapshot?.activeSession),
    [evaluatedAt, snapshot?.activeSession, snapshot?.events],
  );
  const providerRuleResult = useMemo(
    () => evaluateProviderRule(snapshot?.events ?? [], snapshot?.providerRule, evaluatedAt, { t, locale }),
    [evaluatedAt, locale, snapshot?.events, snapshot?.providerRule, t],
  );
  const urgentRuleResult = useMemo(
    () =>
      snapshot
        ? evaluateUrgentRules(snapshot.events, snapshot.profile, evaluatedAt, { t, locale })
        : { active: false, sourceIds: [] as string[] },
    [evaluatedAt, locale, snapshot, t],
  );

  useEffect(() => {
    if (urgentRuleResult.active) {
      void hapticWarning();
    }
  }, [urgentRuleResult.active, urgentRuleResult.type]);

  const shouldAutoClose = useMemo(() => {
    if (!snapshot?.activeSession) {
      return false;
    }
    return shouldStartNewSessionAfterGap(endedEvents(snapshot.events).at(-1), now);
  }, [now, snapshot?.activeSession, snapshot?.events]);

  useEffect(() => {
    if (!busy && shouldAutoClose) {
      void refresh();
    }
  }, [busy, refresh, shouldAutoClose]);

  const readAloudSummary = useMemo(() => {
    if (!snapshot) {
      return '';
    }
    return buildSummaryText({
      profile: snapshot.profile,
      session: snapshot.activeSession,
      events: snapshot.events,
      urgentEvents: snapshot.urgentEvents,
      providerRuleResult,
      now: evaluatedAt,
      rangeLabel: t('time.currentSession'),
      appVersion: '1.0.0',
      includeNotes: true,
      includeUrgentEvents: true,
      locale,
      t,
    });
  }, [evaluatedAt, locale, providerRuleResult, snapshot, t]);

  return {
    loading,
    busy,
    error,
    now,
    snapshot,
    actions,
    summary,
    providerRuleResult,
    urgentRuleResult,
    readAloudSummary,
  };
}

