import { describe, expect, it } from 'vitest';
import { eventDurationSeconds, eventIntervalSeconds, eventRestGapSeconds, formatShortDuration } from '@/domain/timing/timeMath';
import { ContractionEvent } from '@/domain/types';

const baseEvent: ContractionEvent = {
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

describe('time math', () => {
  it('uses start-to-end for duration', () => {
    expect(eventDurationSeconds(baseEvent)).toBe(64);
  });

  it('uses start-to-start for interval', () => {
    const next = { ...baseEvent, id: 'event_2', startAt: '2026-05-10T02:04:45.000Z' };
    expect(eventIntervalSeconds(next, baseEvent)).toBe(285);
  });

  it('uses previous end to current start for rest gap', () => {
    const next = { ...baseEvent, id: 'event_2', startAt: '2026-05-10T02:04:45.000Z' };
    expect(eventRestGapSeconds(next, baseEvent)).toBe(221);
  });

  it('formats short durations for read-aloud summaries', () => {
    expect(formatShortDuration(58)).toBe('58s');
    expect(formatShortDuration(285)).toBe('4m 45s');
  });
});
