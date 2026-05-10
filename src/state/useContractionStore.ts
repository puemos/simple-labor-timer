import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { buildSummaryText } from '@/domain/export/summaryText';
import { evaluateProviderRule } from '@/domain/rules/providerRule';
import { evaluateUrgentRules } from '@/domain/rules/urgentRules';
import { computeSessionSummary } from '@/domain/timing/summaries';
import { nowIso } from '@/domain/timing/timeMath';
import { AppSnapshot, ContractionEvent, PregnancyProfile, ProviderRule, UrgentType } from '@/domain/types';
import { getAppRepository } from '@/data/db';
import { hapticEnd, hapticStart, hapticWarning } from '@/native/haptics';

type EventPatch = Partial<Pick<ContractionEvent, 'startAt' | 'endAt' | 'intensity' | 'note'>>;

type ContractionState = {
  loading: boolean;
  busy: boolean;
  error?: string;
  now: string;
  snapshot?: AppSnapshot;
  hydrate: () => Promise<void>;
  tick: () => void;
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
  set({ busy: true, error: undefined });
  try {
    const snapshot = await action();
    set({ snapshot, busy: false, now: nowIso() });
  } catch (caught) {
    set({
      busy: false,
      now: nowIso(),
      error: caught instanceof Error ? caught.message : 'Something went wrong.',
    });
  }
}

export const useContractionStore = create<ContractionState>((set) => ({
  loading: true,
  busy: false,
  now: nowIso(),
  hydrate: async () => {
    set({ loading: true, error: undefined });
    try {
      const repo = await getAppRepository();
      set({ snapshot: await repo.loadSnapshot(), loading: false, now: nowIso() });
    } catch (caught) {
      set({
        loading: false,
        now: nowIso(),
        error: caught instanceof Error ? caught.message : 'The local database could not be opened.',
      });
    }
  },
  tick: () => set({ now: nowIso() }),
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
  const tick = useContractionStore((state) => state.tick);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);
}

export function useContractionApp() {
  const loading = useContractionStore((state) => state.loading);
  const busy = useContractionStore((state) => state.busy);
  const error = useContractionStore((state) => state.error);
  const now = useContractionStore((state) => state.now);
  const snapshot = useContractionStore((state) => state.snapshot);
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

  const summary = useMemo(
    () => computeSessionSummary(snapshot?.events ?? [], now, snapshot?.activeSession),
    [now, snapshot?.activeSession, snapshot?.events],
  );
  const providerRuleResult = useMemo(
    () => evaluateProviderRule(snapshot?.events ?? [], snapshot?.providerRule, now),
    [now, snapshot?.events, snapshot?.providerRule],
  );
  const urgentRuleResult = useMemo(
    () => (snapshot ? evaluateUrgentRules(snapshot.events, snapshot.profile, now) : { active: false, sourceIds: [] as string[] }),
    [now, snapshot],
  );

  useEffect(() => {
    if (urgentRuleResult.active) {
      void hapticWarning();
    }
  }, [urgentRuleResult.active, urgentRuleResult.type]);

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
      now,
      appVersion: '1.0.0',
      includeNotes: true,
      includeUrgentEvents: true,
    });
  }, [now, providerRuleResult, snapshot]);

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
