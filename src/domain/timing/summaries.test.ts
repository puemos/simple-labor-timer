import { describe, expect, it } from 'vitest';
import { computeSessionSummary } from '@/domain/timing/summaries';
import { ContractionEvent } from '@/domain/types';

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

describe('session summaries', () => {
  it('tracks live rest time from the last contraction end', () => {
    const summary = computeSessionSummary([endedEvent], '2026-05-10T02:03:04.000Z');

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

    const summary = computeSessionSummary([endedEvent, activeEvent], '2026-05-10T02:04:30.000Z');

    expect(summary.currentRestSeconds).toBeUndefined();
  });
});
