import { describe, expect, it } from 'vitest';
import { evaluateProviderRule } from '@/domain/rules/providerRule';
import { evaluateUrgentRules } from '@/domain/rules/urgentRules';
import { buildRhythmSummary } from '@/domain/timing/rhythm';
import { materializeMockContractionScenario } from '@/dev/mockContractionScenarios';

const now = '2026-05-10T10:00:00.000Z';

describe('mock contraction scenarios', () => {
  it('keeps early data in the insufficient-data rhythm state', () => {
    const scenario = materializeMockContractionScenario('early_data', now);
    const summary = buildRhythmSummary(scenario.events, now);

    expect(summary.eventCount).toBe(1);
    expect(summary.pattern).toBe('insufficient_data');
  });

  it('materializes regular 5-1-1 contractions that match the provider rule', () => {
    const scenario = materializeMockContractionScenario('regular_5_1_1', now);
    const summary = buildRhythmSummary(scenario.events, now);
    const result = evaluateProviderRule(scenario.events, scenario.providerRule, now);

    expect(summary.pattern).toBe('regular');
    expect(result.met).toBe(true);
  });

  it('materializes a getting-closer rhythm', () => {
    const scenario = materializeMockContractionScenario('getting_closer', now);
    const summary = buildRhythmSummary(scenario.events, now);

    expect(summary.pattern).toBe('getting_closer');
  });

  it('materializes a spacing-out rhythm', () => {
    const scenario = materializeMockContractionScenario('spacing_out', now);
    const summary = buildRhythmSummary(scenario.events, now);

    expect(summary.pattern).toBe('spacing_out');
  });

  it('materializes an active over-two-minute urgent warning', () => {
    const scenario = materializeMockContractionScenario('active_over_2_min', now);
    const result = evaluateUrgentRules(scenario.events, scenario.profile, now);

    expect(result.active).toBe(true);
    expect(result.type).toBe('contraction_over_2_min');
  });
});
