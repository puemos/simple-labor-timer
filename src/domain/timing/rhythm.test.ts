import { describe, expect, it } from 'vitest';
import {
  buildRhythmSummary,
  defaultRhythmSelectedEventId,
  rhythmEventDetail,
  rhythmStatusText,
} from '@/domain/timing/rhythm';
import { ContractionEvent } from '@/domain/types';

const now = '2026-05-10T10:00:00.000Z';

function event(id: string, startMinute: number, durationSeconds = 60, patch: Partial<ContractionEvent> = {}): ContractionEvent {
  const startAt = new Date(Date.parse(now) + startMinute * 60_000).toISOString();
  return {
    id,
    sessionId: 'session_1',
    startAt,
    endAt: new Date(Date.parse(startAt) + durationSeconds * 1000).toISOString(),
    timezone: 'Europe/Rome',
    manuallyEdited: false,
    clockChangeSuspected: false,
    createdAt: startAt,
    updatedAt: startAt,
    ...patch,
  };
}

describe('rhythm summaries', () => {
  it('handles empty events', () => {
    const summary = buildRhythmSummary([], now);

    expect(summary.eventCount).toBe(0);
    expect(summary.points).toEqual([]);
    expect(summary.averageIntervalSeconds).toBeUndefined();
    expect(summary.pattern).toBe('insufficient_data');
  });

  it('reports one event without an interval', () => {
    const summary = buildRhythmSummary([event('event_1', -10)], now);

    expect(summary.eventCount).toBe(1);
    expect(summary.averageDurationSeconds).toBe(60);
    expect(summary.averageIntervalSeconds).toBeUndefined();
    expect(rhythmStatusText(summary.pattern)).toBe('Need more data');
  });

  it('reports two events with one start-to-start interval', () => {
    const summary = buildRhythmSummary([event('event_1', -10), event('event_2', -5, 75)], now);

    expect(summary.eventCount).toBe(2);
    expect(summary.averageDurationSeconds).toBe(68);
    expect(summary.averageIntervalSeconds).toBe(300);
    expect(summary.points[1].intervalSeconds).toBe(300);
    expect(summary.points[1].restGapSeconds).toBe(240);
  });

  it('includes an active event without an end time', () => {
    const active = event('event_2', -2, 0, { endAt: undefined });
    const summary = buildRhythmSummary([event('event_1', -8), active], now);

    expect(summary.eventCount).toBe(2);
    expect(summary.points.at(-1)?.active).toBe(true);
    expect(summary.points.at(-1)?.durationSeconds).toBe(120);
    expect(defaultRhythmSelectedEventId(summary)).toBe(active.id);
  });

  it('excludes deleted events', () => {
    const summary = buildRhythmSummary([
      event('event_1', -10),
      event('event_2', -5, 60, { deletedAt: '2026-05-10T09:58:00.000Z' }),
    ], now);

    expect(summary.eventCount).toBe(1);
    expect(summary.points.map((point) => point.event.id)).toEqual(['event_1']);
  });

  it('excludes events outside the selected window', () => {
    const summary = buildRhythmSummary([event('event_old', -61), event('event_recent', -5)], now, 60);

    expect(summary.eventCount).toBe(1);
    expect(summary.points[0].event.id).toBe('event_recent');
    expect(summary.points[0].intervalSeconds).toBe(56 * 60);
    expect(summary.averageIntervalSeconds).toBeUndefined();
  });

  it('can use a session start instead of a rolling hour', () => {
    const summary = buildRhythmSummary([event('event_old', -61), event('event_recent', -5)], now, {
      rangeStartAt: '2026-05-10T08:55:00.000Z',
      rangeEndAt: now,
    });

    expect(summary.eventCount).toBe(2);
    expect(summary.windowStartMs).toBe(Date.parse('2026-05-10T08:55:00.000Z'));
    expect(summary.windowMinutes).toBe(65);
    expect(summary.averageIntervalSeconds).toBe(56 * 60);
  });

  it('uses manually edited timestamps and sorts before measuring rhythm', () => {
    const edited = event('event_1', -20, 60, {
      startAt: '2026-05-10T09:45:00.000Z',
      endAt: '2026-05-10T09:46:30.000Z',
      manuallyEdited: true,
    });
    const later = event('event_2', -10, 60);
    const summary = buildRhythmSummary([later, edited], now);

    expect(summary.points.map((point) => point.event.id)).toEqual(['event_1', 'event_2']);
    expect(summary.averageDurationSeconds).toBe(75);
    expect(summary.averageIntervalSeconds).toBe(300);
  });

  it('labels regular, getting closer, spacing out, and irregular patterns', () => {
    const regular = buildRhythmSummary(
      [event('a', -24), event('b', -18), event('c', -12), event('d', -6)],
      now,
    );
    const closer = buildRhythmSummary(
      [event('a', -30), event('b', -22), event('c', -15), event('d', -10), event('e', -5)],
      now,
    );
    const spacingOut = buildRhythmSummary(
      [event('a', -30), event('b', -25), event('c', -20), event('d', -12), event('e', -3)],
      now,
    );
    const irregular = buildRhythmSummary(
      [event('a', -30), event('b', -22), event('c', -16), event('d', -10), event('e', -2)],
      now,
    );

    expect(rhythmStatusText(regular.pattern)).toBe('Holding steady');
    expect(rhythmStatusText(closer.pattern)).toBe('Getting closer');
    expect(rhythmStatusText(spacingOut.pattern)).toBe('Spacing out');
    expect(rhythmStatusText(irregular.pattern)).toBe('Irregular');
  });

  it('returns selected event details', () => {
    const summary = buildRhythmSummary([event('event_1', -10), event('event_2', -5, 75)], now);

    expect(rhythmEventDetail(summary, 'event_2')).toMatchObject({
      durationSeconds: 75,
      intervalSeconds: 300,
      restGapSeconds: 240,
    });
  });
});
