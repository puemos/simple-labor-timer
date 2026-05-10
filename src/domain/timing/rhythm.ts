import { classifyPattern } from '@/domain/timing/patternLabels';
import {
  average,
  eventDurationSeconds,
  eventIntervalSeconds,
  eventRestGapSeconds,
  parseIso,
  visibleEvents,
} from '@/domain/timing/timeMath';
import { ContractionEvent, PatternLabel, ProviderRuleResult, UrgentRuleResult } from '@/domain/types';

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

export type RhythmInsightTone = 'neutral' | 'accent' | 'success' | 'warning' | 'urgent';

export type RhythmInsight = {
  headline: string;
  body: string;
  action: string;
  tone: RhythmInsightTone;
};

export type RhythmInsightOptions = {
  providerRuleResult?: Pick<ProviderRuleResult, 'met' | 'message'>;
  urgentRuleResult?: Pick<UrgentRuleResult, 'active' | 'message'>;
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

export function buildRhythmInsight(summary: RhythmSummary, options: RhythmInsightOptions = {}): RhythmInsight {
  if (options.urgentRuleResult?.active) {
    return {
      headline: 'Call now',
      body: options.urgentRuleResult.message ?? 'A warning sign is active. Contact your care team now.',
      action: 'Contact your care team now.',
      tone: 'urgent',
    };
  }

  if (options.providerRuleResult?.met) {
    return {
      headline: 'Call now',
      body: options.providerRuleResult.message,
      action: 'Call your care team.',
      tone: 'urgent',
    };
  }

  switch (summary.pattern) {
    case 'getting_closer':
      return {
        headline: 'Getting closer',
        body: 'Intervals are getting closer. Keep timing and follow your call rule.',
        action: 'Call if this matches your care team rule.',
        tone: 'accent',
      };
    case 'regular':
      return {
        headline: 'Holding steady',
        body: 'Contractions are coming in a steady rhythm.',
        action: 'Keep timing and watch duration.',
        tone: 'success',
      };
    case 'spacing_out':
      return {
        headline: 'Spacing out',
        body: 'Intervals are getting farther apart.',
        action: 'Keep timing; rest if you can.',
        tone: 'warning',
      };
    case 'inconsistent':
      return {
        headline: 'Irregular',
        body: 'Intervals are still changing from one contraction to the next.',
        action: 'Keep timing until a clearer pattern appears.',
        tone: 'neutral',
      };
    case 'insufficient_data':
      return {
        headline: 'Too early to tell',
        body:
          summary.eventCount < 2
            ? 'Time the next contraction to start reading the rhythm.'
            : 'Keep timing until the rhythm is clearer.',
        action: 'Keep timing the next contraction.',
        tone: 'neutral',
      };
  }
}

function previousVisibleEvent(events: ContractionEvent[], event: ContractionEvent): ContractionEvent | undefined {
  const index = events.findIndex((item) => item.id === event.id);
  return index > 0 ? events[index - 1] : undefined;
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}
