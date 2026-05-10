import { describe, expect, it } from 'vitest';
import { computeSessionSummary } from '@/domain/timing/summaries';
import { ContractionEvent, ContractionSession } from '@/domain/types';

const endedEvent: ContractionEvent = {
  id: 'event_1',
  sessionId: 'session_1',
  startAt: '2026-05-10T02:00:00.000Z',
  endAt: '2026-05-10T02:01:04.000Z',
  timezone: 'Europe/Rome',
  manuallyEdited: false,
  clockChangeSuspected: false,
  createdAt: '2026-05-10T02:00:00.000Z',
  updatedAt: '2026-05-10T02:01:04.000Z',
};

const activeSession: ContractionSession = {
  id: 'session_1',
  startedAt: '2026-05-10T02:00:00.000Z',
  status: 'active',
  contentVersion: 'test',
  createdAt: '2026-05-10T02:00:00.000Z',
  updatedAt: '2026-05-10T02:00:00.000Z',
};

describe('session summaries', () => {
  it('reports idle with no current session or events', () => {
    const summary = computeSessionSummary([], '2026-05-10T02:03:04.000Z');

    expect(summary.timerState).toBe('idle');
    expect(summary.currentRestSeconds).toBeUndefined();
    expect(summary.currentIntervalSeconds).toBeUndefined();
  });

  it('reports measuring while a contraction is active', () => {
    const activeEvent: ContractionEvent = {
      ...endedEvent,
      endAt: undefined,
    };

    const summary = computeSessionSummary([activeEvent], '2026-05-10T02:00:30.000Z', activeSession);

    expect(summary.timerState).toBe('measuring');
    expect(summary.activeEvent?.id).toBe(activeEvent.id);
    expect(summary.currentRestSeconds).toBeUndefined();
  });

  it('tracks live rest time from the last contraction end', () => {
    const summary = computeSessionSummary([endedEvent], '2026-05-10T02:03:04.000Z', activeSession);

    expect(summary.timerState).toBe('resting');
    expect(summary.currentRestSeconds).toBe(120);
    expect(summary.currentIntervalSeconds).toBe(184);
  });

  it('does not expose a resting timer during an active contraction', () => {
    const activeEvent: ContractionEvent = {
      ...endedEvent,
      id: 'event_2',
      startAt: '2026-05-10T02:04:00.000Z',
      endAt: undefined,
      createdAt: '2026-05-10T02:04:00.000Z',
      updatedAt: '2026-05-10T02:04:00.000Z',
    };

    const summary = computeSessionSummary([endedEvent, activeEvent], '2026-05-10T02:04:30.000Z', activeSession);

    expect(summary.timerState).toBe('measuring');
    expect(summary.currentRestSeconds).toBeUndefined();
  });

  it('reports idle and stops live timers after the inactivity cutoff', () => {
    const summary = computeSessionSummary([endedEvent], '2026-05-10T04:01:04.000Z', activeSession);

    expect(summary.timerState).toBe('idle');
    expect(summary.currentRestSeconds).toBeUndefined();
    expect(summary.currentIntervalSeconds).toBeUndefined();
  });
});
