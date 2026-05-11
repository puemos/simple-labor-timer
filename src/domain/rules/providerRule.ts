import { endedEvents, eventDurationSeconds, eventIntervalSeconds, parseIso } from '@/domain/timing/timeMath';
import { ContractionEvent, ProviderRule, ProviderRuleResult } from '@/domain/types';
import { LocaleFormatOptions, resolveT } from '@/i18n/format';

export function evaluateProviderRule(
  events: ContractionEvent[],
  rule: ProviderRule | undefined,
  now: string,
  options?: LocaleFormatOptions,
): ProviderRuleResult {
  const t = resolveT(options);
  if (!rule) {
    return {
      met: false,
      label: t('rules.noSavedRuleLabel'),
      message: t('rules.noSavedRuleMessage'),
      ruleStatus: 'not_saved',
      sourceIds: [],
      matchedEventIds: [],
    };
  }

  const ended = endedEvents(events);
  if (ended.length < 3) {
    return {
      met: false,
      label: rule.label,
      message: t('rules.moreNeeded'),
      ruleStatus: 'insufficient_data',
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
    message: met ? t('rules.matched') : t('rules.notMatched'),
    ruleStatus: met ? 'matched' : 'not_matched',
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
      actionText: '',
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
      actionText: '',
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
      actionText: '',
      source: 'app_default',
      createdAt: now,
      updatedAt: now,
    },
  ];
}
