import { describe, expect, it } from 'vitest';
import { evaluateProviderRule } from '@/domain/rules/providerRule';
import { evaluateUrgentRules } from '@/domain/rules/urgentRules';
import { ContractionEvent, PregnancyProfile, ProviderRule } from '@/domain/types';

const profile: PregnancyProfile = {
  id: 'profile',
  region: 'US',
  emergencyPhone: '911',
  plannedCesarean: false,
  highRiskOrCallEarly: false,
  createdAt: '2026-05-10T02:00:00.000Z',
  updatedAt: '2026-05-10T02:00:00.000Z',
};

const rule: ProviderRule = {
  id: 'rule',
  profileId: 'profile',
  intervalSecondsMax: 5 * 60,
  durationSecondsMin: 60,
  observationWindowMinutes: 60,
  label: '5-1-1',
  actionText: 'Call your care team',
  source: 'app_default',
  createdAt: '2026-05-10T02:00:00.000Z',
  updatedAt: '2026-05-10T02:00:00.000Z',
};

describe('rules', () => {
  it('matches a saved provider rule deterministically', () => {
    const events = makeEvents(10, 5, 65);
    const result = evaluateProviderRule(events, rule, '2026-05-10T02:50:00.000Z');
    expect(result.met).toBe(true);
    expect(result.message).toContain('saved call rule');
  });

  it('does not match provider rule when intervals are too far apart', () => {
    const events = makeEvents(5, 8, 65);
    const result = evaluateProviderRule(events, rule, '2026-05-10T02:50:00.000Z');
    expect(result.met).toBe(false);
  });

  it('flags preterm frequent contractions', () => {
    const events = makeEvents(4, 9, 45);
    const result = evaluateUrgentRules(events, { ...profile, gestationalAgeAtSetupDays: 36 * 7 }, '2026-05-10T02:30:00.000Z');
    expect(result.active).toBe(true);
    expect(result.type).toBe('under_37_weeks_labor_concern');
  });

  it('flags active contractions over two minutes', () => {
    const event = makeEvents(1, 5, 65)[0];
    const result = evaluateUrgentRules([{ ...event, endAt: undefined }], profile, '2026-05-10T02:02:00.000Z');
    expect(result.active).toBe(true);
    expect(result.type).toBe('contraction_over_2_min');
  });
});

function makeEvents(count: number, intervalMinutes: number, durationSeconds: number): ContractionEvent[] {
  const start = Date.parse('2026-05-10T02:00:00.000Z');
  return Array.from({ length: count }, (_, index) => {
    const startAt = new Date(start + index * intervalMinutes * 60_000).toISOString();
    return {
      id: `event_${index}`,
      sessionId: 'session',
      startAt,
      endAt: new Date(Date.parse(startAt) + durationSeconds * 1000).toISOString(),
      timezone: 'Europe/Rome',
      manuallyEdited: false,
      clockChangeSuspected: false,
      createdAt: startAt,
      updatedAt: startAt,
    };
  });
}
