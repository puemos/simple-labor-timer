import { nowIso, parseIso } from '@/domain/timing/timeMath';
import type { AppRepositoryContract } from '@/data/repositoryContract';
import type { AppSnapshot, ContractionEvent, Intensity, PregnancyProfile, ProviderRule } from '@/domain/types';

const MOCK_PROFILE_ID = 'profile_default';
const MOCK_PROVIDER_RULE_ID = 'rule_default_5_1_1';
const MOCK_TIMEZONE = 'Europe/Rome';

type MockEventTemplate = {
  startOffsetMinutes: number;
  durationSeconds?: number;
  active?: boolean;
  intensity?: Intensity;
  note?: string;
};

type MockContractionScenarioDefinition = {
  key: string;
  name: string;
  description: string;
  events: readonly MockEventTemplate[];
};

export const MOCK_CONTRACTION_SCENARIOS = [
  {
    key: 'early_data',
    name: 'Early data',
    description: 'One timed contraction so rhythm still needs more data.',
    events: [{ startOffsetMinutes: -8, durationSeconds: 55, intensity: 'mild' }],
  },
  {
    key: 'regular_5_1_1',
    name: 'Regular 5-1-1',
    description: 'One-minute contractions every five minutes for the saved call rule.',
    events: [
      { startOffsetMinutes: -48, durationSeconds: 65, intensity: 'moderate' },
      { startOffsetMinutes: -43, durationSeconds: 66, intensity: 'moderate' },
      { startOffsetMinutes: -38, durationSeconds: 64, intensity: 'moderate' },
      { startOffsetMinutes: -33, durationSeconds: 67, intensity: 'moderate' },
      { startOffsetMinutes: -28, durationSeconds: 65, intensity: 'moderate' },
      { startOffsetMinutes: -23, durationSeconds: 66, intensity: 'strong' },
      { startOffsetMinutes: -18, durationSeconds: 64, intensity: 'strong' },
      { startOffsetMinutes: -13, durationSeconds: 67, intensity: 'strong' },
      { startOffsetMinutes: -8, durationSeconds: 65, intensity: 'strong' },
      { startOffsetMinutes: -3, durationSeconds: 66, intensity: 'strong' },
    ],
  },
  {
    key: 'getting_closer',
    name: 'Getting closer',
    description: 'Intervals tighten over the session without meeting the call rule yet.',
    events: [
      { startOffsetMinutes: -42, durationSeconds: 55, intensity: 'mild' },
      { startOffsetMinutes: -34, durationSeconds: 56, intensity: 'mild' },
      { startOffsetMinutes: -27, durationSeconds: 58, intensity: 'moderate' },
      { startOffsetMinutes: -21, durationSeconds: 57, intensity: 'moderate' },
      { startOffsetMinutes: -16, durationSeconds: 59, intensity: 'moderate' },
      { startOffsetMinutes: -12, durationSeconds: 58, intensity: 'strong' },
    ],
  },
  {
    key: 'spacing_out',
    name: 'Spacing out',
    description: 'Intervals spread farther apart so the rhythm reads as spacing out.',
    events: [
      { startOffsetMinutes: -42, durationSeconds: 56, intensity: 'moderate' },
      { startOffsetMinutes: -38, durationSeconds: 55, intensity: 'moderate' },
      { startOffsetMinutes: -33, durationSeconds: 57, intensity: 'moderate' },
      { startOffsetMinutes: -27, durationSeconds: 56, intensity: 'mild' },
      { startOffsetMinutes: -20, durationSeconds: 55, intensity: 'mild' },
      { startOffsetMinutes: -12, durationSeconds: 54, intensity: 'mild' },
    ],
  },
  {
    key: 'active_over_2_min',
    name: 'Active over 2 min',
    description: 'An active contraction has passed two minutes for urgent-warning testing.',
    events: [
      { startOffsetMinutes: -15, durationSeconds: 60, intensity: 'moderate' },
      { startOffsetMinutes: -8, durationSeconds: 62, intensity: 'moderate' },
      { startOffsetMinutes: -2.5, active: true, intensity: 'strong', note: 'Active mock contraction' },
    ],
  },
] as const satisfies readonly MockContractionScenarioDefinition[];

export type MockContractionScenarioKey = (typeof MOCK_CONTRACTION_SCENARIOS)[number]['key'];

export type MaterializedMockContractionScenario = {
  key: MockContractionScenarioKey;
  name: string;
  description: string;
  at: string;
  profile: PregnancyProfile;
  providerRule: ProviderRule;
  events: ContractionEvent[];
};

export function materializeMockContractionScenario(
  key: MockContractionScenarioKey,
  at = nowIso(),
): MaterializedMockContractionScenario {
  const scenario = findScenario(key);
  const profile = mockProfile(at);
  const sessionId = `mock_${scenario.key}_session`;
  const events = scenario.events
    .map((event, index) => materializeEvent(event, index, scenario.key, sessionId, at))
    .sort((a, b) => parseIso(a.startAt) - parseIso(b.startAt));

  return {
    key,
    name: scenario.name,
    description: scenario.description,
    at,
    profile,
    providerRule: mockProviderRule(profile.id, at),
    events,
  };
}

export async function applyMockContractionScenario(
  key: MockContractionScenarioKey,
  at = nowIso(),
  repository?: AppRepositoryContract,
): Promise<AppSnapshot> {
  const repo = repository ?? (await getRepository());
  const scenario = materializeMockContractionScenario(key, at);
  let snapshot = await repo.deleteAllData(at);

  snapshot = await repo.saveProfile(scenario.profile, at);
  snapshot = await repo.saveProviderRule(scenario.providerRule, at);

  for (const event of scenario.events) {
    if (event.endAt) {
      snapshot = await repo.addMissedEvent(event.startAt, event.endAt, event.updatedAt);
      const added = snapshot.events.find((item) => item.startAt === event.startAt && item.endAt === event.endAt);
      if (added && (event.intensity || event.note)) {
        snapshot = await repo.updateEvent(added.id, { intensity: event.intensity, note: event.note }, event.updatedAt);
      }
      continue;
    }

    snapshot = await repo.startContraction(event.startAt);
    const active = snapshot.events.find((item) => item.startAt === event.startAt && !item.endAt);
    if (active && (event.intensity || event.note)) {
      snapshot = await repo.updateEvent(active.id, { intensity: event.intensity, note: event.note }, event.updatedAt);
    }
  }

  return repo.loadSnapshot(at);
}

function findScenario(key: MockContractionScenarioKey) {
  const scenario = MOCK_CONTRACTION_SCENARIOS.find((item) => item.key === key);
  if (!scenario) {
    throw new Error(`Unknown mock contraction scenario: ${key}`);
  }
  return scenario;
}

function materializeEvent(
  event: MockEventTemplate,
  index: number,
  scenarioKey: string,
  sessionId: string,
  at: string,
): ContractionEvent {
  const startAt = new Date(parseIso(at) + event.startOffsetMinutes * 60_000).toISOString();
  const endAt =
    event.active || event.durationSeconds === undefined
      ? undefined
      : new Date(parseIso(startAt) + event.durationSeconds * 1000).toISOString();

  return {
    id: `mock_${scenarioKey}_event_${index + 1}`,
    sessionId,
    startAt,
    endAt,
    timezone: MOCK_TIMEZONE,
    intensity: event.intensity,
    note: event.note,
    manuallyEdited: false,
    clockChangeSuspected: false,
    createdAt: startAt,
    updatedAt: endAt ?? startAt,
  };
}

function mockProfile(at: string): PregnancyProfile {
  return {
    id: MOCK_PROFILE_ID,
    estimatedDueDate: undefined,
    gestationalAgeAtSetupDays: 39 * 7,
    region: 'US',
    careTeamPhone: undefined,
    birthLocationPhone: undefined,
    doulaName: undefined,
    doulaPhone: undefined,
    emergencyPhone: '911',
    plannedCesarean: false,
    highRiskOrCallEarly: false,
    createdAt: at,
    updatedAt: at,
  };
}

function mockProviderRule(profileId: string, at: string): ProviderRule {
  return {
    id: MOCK_PROVIDER_RULE_ID,
    profileId,
    intervalSecondsMax: 5 * 60,
    durationSecondsMin: 60,
    observationWindowMinutes: 60,
    label: '5-1-1',
    actionText: 'Call your care team',
    source: 'app_default',
    createdAt: at,
    updatedAt: at,
  };
}

async function getRepository(): Promise<AppRepositoryContract> {
  const { getAppRepository } = await import('@/data/db');
  return getAppRepository();
}
