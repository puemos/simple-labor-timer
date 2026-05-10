import { describe, expect, it } from 'vitest';
import { shouldStartNewSessionAfterGap } from '@/domain/timing/sessionGrouping';
import { ContractionEvent } from '@/domain/types';

const endedEvent: ContractionEvent = {
  id: 'event_1',
  sessionId: 'session_1',
  startAt: '2026-05-10T00:00:00.000Z',
  endAt: '2026-05-10T00:01:00.000Z',
  timezone: 'Europe/Rome',
  manuallyEdited: false,
  clockChangeSuspected: false,
  createdAt: '2026-05-10T00:00:00.000Z',
  updatedAt: '2026-05-10T00:01:00.000Z',
};

describe('session grouping', () => {
  it('keeps contractions in one session before the quiet gap', () => {
    expect(shouldStartNewSessionAfterGap(endedEvent, '2026-05-10T02:00:59.000Z')).toBe(false);
  });

  it('starts a new session at the quiet gap boundary', () => {
    expect(shouldStartNewSessionAfterGap(endedEvent, '2026-05-10T02:01:00.000Z')).toBe(true);
  });

  it('starts a new session after the quiet gap', () => {
    expect(shouldStartNewSessionAfterGap(endedEvent, '2026-05-10T03:30:00.000Z')).toBe(true);
  });

  it('does not split while the previous contraction is active', () => {
    expect(shouldStartNewSessionAfterGap({ ...endedEvent, endAt: undefined }, '2026-05-10T03:30:00.000Z')).toBe(false);
  });
});
