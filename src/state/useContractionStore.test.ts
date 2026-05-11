import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateProviderRule } from '@/domain/rules/providerRule';
import { evaluateUrgentRules } from '@/domain/rules/urgentRules';
import { MemoryRepository } from '@/data/memoryRepository';
import { visibleEvents } from '@/domain/timing/timeMath';
import { useContractionStore } from '@/state/useContractionStore';

const { repoState } = vi.hoisted(() => ({
  repoState: { current: null as unknown as { value: MemoryRepository } },
}));
repoState.current = { value: new MemoryRepository() };

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  impactAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  selectionAsync: vi.fn(async () => undefined),
}));

vi.mock('@/i18n', () => ({
  useAppLanguage: () => ({ locale: 'en', preference: 'en', isRTL: false, setPreference: () => undefined }),
  useAppTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/data/db', () => ({
  getAppRepository: async () => repoState.current.value,
}));

const initialState = useContractionStore.getState();

function resetStore() {
  useContractionStore.setState({
    loading: true,
    busy: false,
    error: undefined,
    errorKey: undefined,
    snapshot: undefined,
    hydrate: initialState.hydrate,
    refresh: initialState.refresh,
    start: initialState.start,
    end: initialState.end,
    undo: initialState.undo,
    restore: initialState.restore,
    deleteEvent: initialState.deleteEvent,
    updateEvent: initialState.updateEvent,
    addMissedEvent: initialState.addMissedEvent,
    splitEvent: initialState.splitEvent,
    mergeWithPrevious: initialState.mergeWithPrevious,
    recordUrgent: initialState.recordUrgent,
    saveProfile: initialState.saveProfile,
    saveProviderRule: initialState.saveProviderRule,
    closeSession: initialState.closeSession,
    deleteAllData: initialState.deleteAllData,
  });
}

beforeEach(() => {
  repoState.current.value = new MemoryRepository();
  resetStore();
});

describe('useContractionStore — store-level integration', () => {
  it('start → end → undo → restore round-trip leaves snapshot consistent', async () => {
    await useContractionStore.getState().hydrate();

    await useContractionStore.getState().start();
    let snapshot = useContractionStore.getState().snapshot!;
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0].endAt).toBeUndefined();

    await useContractionStore.getState().end();
    snapshot = useContractionStore.getState().snapshot!;
    expect(snapshot.events[0].endAt).toBeDefined();

    await useContractionStore.getState().undo();
    snapshot = useContractionStore.getState().snapshot!;
    expect(visibleEvents(snapshot.allEvents)).toHaveLength(0);
    expect(snapshot.allEvents[0].deletedAt).toBeDefined();

    await useContractionStore.getState().restore();
    snapshot = useContractionStore.getState().snapshot!;
    expect(visibleEvents(snapshot.allEvents)).toHaveLength(1);
    expect(snapshot.allEvents[0].deletedAt).toBeUndefined();
  });

  it('provider rule transitions to met after canonical 5-1-1 inputs', async () => {
    const repo = repoState.current.value;
    const baseMs = Date.parse('2026-05-10T00:00:00.000Z');
    const eventCount = 12;
    for (let index = 0; index < eventCount; index += 1) {
      const startMs = baseMs + index * 5 * 60_000;
      const endMs = startMs + 65_000;
      const startIso = new Date(startMs).toISOString();
      const endIso = new Date(endMs).toISOString();
      await repo.addMissedEvent(startIso, endIso, endIso);
    }

    const now = new Date(baseMs + (eventCount - 1) * 5 * 60_000 + 65_000 + 1_000).toISOString();
    const snapshot = await repo.loadSnapshot(now);
    const result = evaluateProviderRule(snapshot.events, snapshot.providerRule, now);

    expect(result.ruleStatus).toBe('matched');
    expect(result.met).toBe(true);
    expect(result.matchedEventIds.length).toBeGreaterThanOrEqual(3);
  });

  it('urgent rule fires when an active contraction exceeds two minutes', async () => {
    const repo = repoState.current.value;
    await repo.startContraction('2026-05-10T00:00:00.000Z');
    const now = '2026-05-10T00:02:30.000Z';
    const snapshot = await repo.loadSnapshot(now);
    const result = evaluateUrgentRules(snapshot.events, snapshot.profile, now);

    expect(result.active).toBe(true);
    expect(result.type).toBe('contraction_over_2_min');
  });

  it('records a water_broke urgent event on the active session', async () => {
    await useContractionStore.getState().hydrate();
    await useContractionStore.getState().start();
    await useContractionStore.getState().recordUrgent('water_broke', 'membranes ruptured', true);

    const snapshot = useContractionStore.getState().snapshot!;
    expect(snapshot.urgentEvents).toHaveLength(1);
    expect(snapshot.urgentEvents[0].type).toBe('water_broke');
    expect(snapshot.urgentEvents[0].note).toBe('membranes ruptured');
  });

  it('auto-closes a stale active session after the quiet-hour gap on refresh', async () => {
    const repo = repoState.current.value;
    await repo.startContraction('2026-05-10T00:00:00.000Z');
    await repo.endContraction('2026-05-10T00:01:00.000Z');

    const original = repo.loadSnapshot.bind(repo);
    const loadSpy = vi
      .spyOn(repo, 'loadSnapshot')
      .mockImplementation((at?: string) => original(at ?? '2026-05-10T02:01:00.000Z'));

    await useContractionStore.getState().hydrate();
    const snapshot = useContractionStore.getState().snapshot!;

    expect(snapshot.activeSession).toBeUndefined();
    expect(snapshot.latestSession?.status).toBe('closed');
    expect(snapshot.latestSession?.endedAt).toBe('2026-05-10T00:01:00.000Z');

    loadSpy.mockRestore();
  });

  it('snapshot evaluatedAt is set by repository and clock ticks do not affect it', async () => {
    const repo = repoState.current.value;
    const at = '2026-05-10T01:23:45.000Z';
    const snapshot = await repo.loadSnapshot(at);

    expect(snapshot.evaluatedAt).toBe(at);

    const later = await repo.loadSnapshot('2026-05-10T01:25:00.000Z');
    expect(later.evaluatedAt).toBe('2026-05-10T01:25:00.000Z');
    expect(later.evaluatedAt).not.toBe(snapshot.evaluatedAt);
  });

  it('clock store ticks independently of the contraction store snapshot', async () => {
    const { useClockStore } = await import('@/state/useClock');
    useClockStore.setState({ now: '2026-05-10T00:00:00.000Z' });

    await useContractionStore.getState().hydrate();
    const evaluatedAtBefore = useContractionStore.getState().snapshot?.evaluatedAt;

    useClockStore.getState().tick();
    useClockStore.setState({ now: '2026-05-10T01:00:00.000Z' });

    expect(useContractionStore.getState().snapshot?.evaluatedAt).toBe(evaluatedAtBefore);
  });

  it('deleteAllData clears events but keeps default profile and provider rule', async () => {
    await useContractionStore.getState().hydrate();
    await useContractionStore.getState().start();
    await useContractionStore.getState().end();
    await useContractionStore.getState().deleteAllData();

    const snapshot = useContractionStore.getState().snapshot!;
    expect(snapshot.allEvents).toHaveLength(0);
    expect(snapshot.allUrgentEvents).toHaveLength(0);
    expect(snapshot.sessions).toHaveLength(0);
    expect(snapshot.profile.id).toBe('profile_default');
    expect(snapshot.providerRule?.id).toBe('rule_default_5_1_1');
  });
});
