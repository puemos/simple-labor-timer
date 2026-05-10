import { endedEvents, eventDurationSeconds, eventIntervalSeconds, parseIso } from '@/domain/timing/timeMath';
import { ContractionEvent, ProviderRule, ProviderRuleResult } from '@/domain/types';

export function evaluateProviderRule(
  events: ContractionEvent[],
  rule: ProviderRule | undefined,
  now: string,
): ProviderRuleResult {
  if (!rule) {
    return {
      met: false,
      label: 'No saved call rule',
      message: 'No saved call rule is active.',
      sourceIds: [],
      matchedEventIds: [],
    };
  }

  const ended = endedEvents(events);
  if (ended.length < 3) {
    return {
      met: false,
      label: rule.label,
      message: 'More contractions are needed before checking this rule.',
      sourceIds: ['S2', 'S4'],
      matchedEventIds: [],
    };
  }

  const windowStartMs = parseIso(now) - rule.observationWindowMinutes * 60_000;
  const inWindow = ended.filter((event) => parseIso(event.startAt) >= windowStartMs);
  const enoughWindow = inWindow.length >= 3;
  const allLongEnough = inWindow.every((event) => {
    const duration = eventDurationSeconds(event, now);
    return duration !== undefined && duration >= rule.durationSecondsMin;
  });
  const intervals = inWindow
    .map((event, index) => eventIntervalSeconds(event, inWindow[index - 1]))
    .filter((value): value is number => value !== undefined);
  const closeEnough = intervals.length >= 2 && intervals.every((value) => value <= rule.intervalSecondsMax);
  const observedSpanMinutes =
    inWindow.length >= 2 ? (parseIso(inWindow.at(-1)!.startAt) - parseIso(inWindow[0].startAt)) / 60_000 : 0;
  const longEnoughObservation = observedSpanMinutes >= Math.max(10, rule.observationWindowMinutes * 0.75);
  const met = enoughWindow && allLongEnough && closeEnough && longEnoughObservation;

  return {
    met,
    label: rule.label,
    message: met
      ? 'This matches your saved call rule. Contact your care team.'
      : 'This has not matched your saved call rule yet.',
    sourceIds: ['S2', 'S4'],
    matchedEventIds: met ? inWindow.map((event) => event.id) : [],
  };
}

export function presetProviderRules(profileId: string, now: string): ProviderRule[] {
  return [
    {
      id: 'rule_5_1_1',
      profileId,
      intervalSecondsMax: 5 * 60,
      durationSecondsMin: 60,
      observationWindowMinutes: 60,
      label: '5-1-1',
      actionText: 'Call your care team',
      source: 'app_default',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'rule_4_1_1',
      profileId,
      intervalSecondsMax: 4 * 60,
      durationSecondsMin: 60,
      observationWindowMinutes: 60,
      label: '4-1-1',
      actionText: 'Call your care team',
      source: 'app_default',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'rule_3_1_1',
      profileId,
      intervalSecondsMax: 3 * 60,
      durationSecondsMin: 60,
      observationWindowMinutes: 60,
      label: '3-1-1',
      actionText: 'Call your care team',
      source: 'app_default',
      createdAt: now,
      updatedAt: now,
    },
  ];
}
