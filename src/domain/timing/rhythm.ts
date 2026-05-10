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
import { LocaleFormatOptions, resolveT } from '@/i18n/format';

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
} & LocaleFormatOptions;

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

export function rhythmStatusText(pattern: PatternLabel, options?: LocaleFormatOptions): string {
  const t = resolveT(options);
  switch (pattern) {
    case 'getting_closer':
      return t('rhythm.statusGettingCloser');
    case 'spacing_out':
      return t('rhythm.statusSpacingOut');
    case 'regular':
      return t('rhythm.statusHoldingSteady');
    case 'inconsistent':
      return t('rhythm.statusIrregular');
    case 'insufficient_data':
      return t('rhythm.statusNeedMoreData');
  }
}

export function buildRhythmInsight(summary: RhythmSummary, options: RhythmInsightOptions = {}): RhythmInsight {
  const t = resolveT(options);
  if (options.urgentRuleResult?.active) {
    return {
      headline: t('rhythm.insightCallNow'),
      body: options.urgentRuleResult.message ?? t('timer.urgentWarningFallback'),
      action: t('rhythm.insightCallNowCareTeam'),
      tone: 'urgent',
    };
  }

  if (options.providerRuleResult?.met) {
    return {
      headline: t('rhythm.insightCallNow'),
      body: options.providerRuleResult.message,
      action: t('rhythm.insightCallYourCareTeam'),
      tone: 'urgent',
    };
  }

  switch (summary.pattern) {
    case 'getting_closer':
      return {
        headline: t('rhythm.statusGettingCloser'),
        body: t('rhythm.insightGettingCloserBody'),
        action: t('rhythm.insightGettingCloserAction'),
        tone: 'accent',
      };
    case 'regular':
      return {
        headline: t('rhythm.statusHoldingSteady'),
        body: t('rhythm.insightHoldingSteadyBody'),
        action: t('rhythm.insightHoldingSteadyAction'),
        tone: 'success',
      };
    case 'spacing_out':
      return {
        headline: t('rhythm.statusSpacingOut'),
        body: t('rhythm.insightSpacingOutBody'),
        action: t('rhythm.insightSpacingOutAction'),
        tone: 'warning',
      };
    case 'inconsistent':
      return {
        headline: t('rhythm.statusIrregular'),
        body: t('rhythm.insightIrregularBody'),
        action: t('rhythm.insightIrregularAction'),
        tone: 'neutral',
      };
    case 'insufficient_data':
      return {
        headline: t('rhythm.insightTooEarly'),
        body:
          summary.eventCount < 2
            ? t('rhythm.insightNextContractionBody')
            : t('rhythm.insightKeepTimingBody'),
        action: t('rhythm.insightKeepTimingAction'),
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
