import { activeEvent, eventDurationSeconds, eventIntervalSeconds, visibleEvents } from '@/domain/timing/timeMath';
import { ContractionEvent, PregnancyProfile, UrgentRuleResult } from '@/domain/types';
import { LocaleFormatOptions, resolveT } from '@/i18n/format';

export function evaluateUrgentRules(
  events: ContractionEvent[],
  profile: PregnancyProfile,
  now: string,
  options?: LocaleFormatOptions,
): UrgentRuleResult {
  const t = resolveT(options);
  const active = activeEvent(events);
  if (active && (eventDurationSeconds(active, now) ?? 0) >= 120) {
    return {
      active: true,
      type: 'contraction_over_2_min',
      message: t('rules.urgentOver2Min'),
      sourceIds: ['S4'],
    };
  }

  const gestationalDays = profile.gestationalAgeAtSetupDays;
  const under37Weeks = gestationalDays !== undefined && gestationalDays < 37 * 7;
  if (under37Weeks) {
    const visible = visibleEvents(events);
    const lastThreeIntervals = visible
      .slice(-4)
      .map((event, index, list) => eventIntervalSeconds(event, list[index - 1]))
      .filter((value): value is number => value !== undefined)
      .slice(-3);
    if (lastThreeIntervals.length === 3 && lastThreeIntervals.every((seconds) => seconds <= 10 * 60)) {
      return {
        active: true,
        type: 'under_37_weeks_labor_concern',
        message: t('rules.urgentUnder37'),
        sourceIds: ['S3', 'S4'],
      };
    }
  }

  if (profile.plannedCesarean || profile.highRiskOrCallEarly) {
    return {
      active: true,
      type: 'planned_c_section_or_call_early',
      message: t('rules.urgentCallEarly'),
      sourceIds: ['S4'],
    };
  }

  return { active: false, sourceIds: [] };
}

export const urgentTypeLabels: Record<NonNullable<UrgentRuleResult['type']>, string> = {
  water_broke: 'Waters broke',
  vaginal_bleeding: 'Vaginal bleeding',
  reduced_fetal_movement: 'Baby moving less than usual',
  under_37_weeks_labor_concern: 'Under 37 weeks and labor concern',
  contraction_over_2_min: 'Contraction over 2 minutes',
  severe_or_unusual_pain: 'Severe or unusual pain',
  fever_unwell: 'Fever or feeling very unwell',
  planned_c_section_or_call_early: 'Planned C-section or call early',
};

export function urgentTypeLabel(type: NonNullable<UrgentRuleResult['type']>, options?: LocaleFormatOptions): string {
  return resolveT(options)(`urgentTypes.${type}`);
}
