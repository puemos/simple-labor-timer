import { classifyPattern } from '@/domain/timing/patternLabels';
import {
  average,
  eventDurationSeconds,
  eventIntervalSeconds,
  eventRestGapSeconds,
  parseIso,
  visibleEvents,
} from '@/domain/timing/timeMath';
import { ContractionEvent, PatternLabel } from '@/domain/types';

export const DEFAULT_RHYTHM_WINDOW_MINUTES = 60;

export type RhythmRange =
  | number
  | {
      rangeStartAt?: string;
      rangeEndAt?: string;
    };

export type RhythmPoint = {
  event: ContractionEvent;
  previousEvent?: ContractionEvent;
  durationSeconds: number;
  intervalSeconds?: number;
  restGapSeconds?: number;
  startRatio: number;
  widthRatio: number;
  active: boolean;
};

export type RhythmSummary = {
  windowMinutes: number;
  windowStartMs: number;
  windowEndMs: number;
  events: ContractionEvent[];
  points: RhythmPoint[];
  eventCount: number;
  averageIntervalSeconds?: number;
  averageDurationSeconds?: number;
  pattern: PatternLabel;
};

export type RhythmEventDetail = {
  event: ContractionEvent;
  durationSeconds: number;
  intervalSeconds?: number;
  restGapSeconds?: number;
};

export function buildRhythmSummary(
  events: ContractionEvent[],
  now: string,
  range: RhythmRange = DEFAULT_RHYTHM_WINDOW_MINUTES,
): RhythmSummary {
  const sorted = visibleEvents(events);
  const rangeOptions: { windowMinutes?: number; rangeStartAt?: string; rangeEndAt?: string } =
    typeof range === 'number' ? { windowMinutes: range } : range;
  const windowEndMs = parseIso(rangeOptions.rangeEndAt ?? now);
  const windowStartMs = rangeOptions.rangeStartAt
    ? parseIso(rangeOptions.rangeStartAt)
    : windowEndMs - (rangeOptions.windowMinutes ?? DEFAULT_RHYTHM_WINDOW_MINUTES) * 60_000;
  const windowSeconds = Math.max(60, Math.round((windowEndMs - windowStartMs) / 1000));
  const windowMinutes = Math.max(1, Math.ceil(windowSeconds / 60));
  const inWindow = sorted.filter((event) => {
    const startMs = parseIso(event.startAt);
    return startMs >= windowStartMs && startMs <= windowEndMs;
  });
  const windowIntervals = inWindow
    .map((event, index) => eventIntervalSeconds(event, inWindow[index - 1]))
    .filter((value): value is number => value !== undefined);
  const durations = inWindow
    .map((event) => eventDurationSeconds(event, now))
    .filter((value): value is number => value !== undefined);
  const points = inWindow.map((event) => {
    const startMs = parseIso(event.startAt);
    const endMs = Math.min(event.endAt ? parseIso(event.endAt) : windowEndMs, windowEndMs);
    const previousEvent = previousVisibleEvent(sorted, event);
    return {
      event,
      previousEvent,
      durationSeconds: eventDurationSeconds(event, now) ?? 0,
      intervalSeconds: eventIntervalSeconds(event, previousEvent),
      restGapSeconds: eventRestGapSeconds(event, previousEvent),
      startRatio: clampRatio((startMs - windowStartMs) / (windowSeconds * 1000)),
      widthRatio: clampRatio((Math.max(startMs, endMs) - startMs) / (windowSeconds * 1000)),
      active: !event.endAt,
    };
  });

  return {
    windowMinutes,
    windowStartMs,
    windowEndMs,
    events: inWindow,
    points,
    eventCount: inWindow.length,
    averageIntervalSeconds: average(windowIntervals),
    averageDurationSeconds: average(durations),
    pattern: classifyPattern(windowIntervals),
  };
}

export function rhythmStatusText(pattern: PatternLabel): string {
  switch (pattern) {
    case 'getting_closer':
      return 'Getting closer';
    case 'spacing_out':
      return 'Spacing out';
    case 'regular':
      return 'Holding steady';
    case 'inconsistent':
      return 'Irregular';
    case 'insufficient_data':
      return 'Need more data';
  }
}

export function defaultRhythmSelectedEventId(summary: RhythmSummary): string | undefined {
  const active = summary.points.find((point) => point.active);
  if (active) {
    return active.event.id;
  }
  return summary.points.at(-1)?.event.id;
}

export function rhythmEventDetail(summary: RhythmSummary, eventId: string | undefined): RhythmEventDetail | undefined {
  const point = summary.points.find((item) => item.event.id === eventId);
  if (!point) {
    return undefined;
  }
  return {
    event: point.event,
    durationSeconds: point.durationSeconds,
    intervalSeconds: point.intervalSeconds,
    restGapSeconds: point.restGapSeconds,
  };
}

function previousVisibleEvent(events: ContractionEvent[], event: ContractionEvent): ContractionEvent | undefined {
  const index = events.findIndex((item) => item.id === event.id);
  return index > 0 ? events[index - 1] : undefined;
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}
