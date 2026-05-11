import type { Href } from 'expo-router';
import { applyMockContractionScenario } from '@/dev/mockContractionScenarios';
import type { MockContractionScenarioKey } from '@/dev/mockContractionScenarios';
import { useContractionStore } from '@/state/useContractionStore';

export const SCREENSHOT_SHOTS = [
  'timer-active',
  'rhythm',
  'call-rule',
  'history',
  'share',
] as const;

export type ScreenshotShot = (typeof SCREENSHOT_SHOTS)[number];

type ScreenshotScenario = {
  scenario: MockContractionScenarioKey;
  route: Href;
};

const screenshotScenarios = {
  'timer-active': {
    scenario: 'timer_active',
    route: '/timer',
  },
  rhythm: {
    scenario: 'getting_closer',
    route: '/rhythm',
  },
  'call-rule': {
    scenario: 'regular_5_1_1',
    route: '/timer',
  },
  history: {
    scenario: 'regular_5_1_1',
    route: '/history',
  },
  share: {
    scenario: 'regular_5_1_1',
    route: { pathname: '/share', params: { preview: '1' } },
  },
} as const satisfies Record<ScreenshotShot, ScreenshotScenario>;

export async function prepareScreenshotScenario(shot: string): Promise<Href | undefined> {
  if (!isScreenshotShot(shot)) {
    return undefined;
  }

  const config = screenshotScenarios[shot];
  await applyMockContractionScenario(config.scenario);
  await useContractionStore.getState().hydrate();
  return config.route;
}

function isScreenshotShot(shot: string): shot is ScreenshotShot {
  return SCREENSHOT_SHOTS.includes(shot as ScreenshotShot);
}
