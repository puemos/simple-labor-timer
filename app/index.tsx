import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { getAppRepository } from '@/data/db';
import type { AppSnapshot, Intensity } from '@/domain/types';
import { useContractionStore } from '@/state/useContractionStore';

export default function Index() {
  const { shot } = useLocalSearchParams<{ shot?: string }>();

  useEffect(() => {
    if (!shot || !__DEV__) {
      return;
    }
    void prepareScreenshot(shot);
  }, [shot]);

  if (shot && __DEV__) {
    return null;
  }

  return <Redirect href="/timer" />;
}

async function prepareScreenshot(shot: string) {
  switch (shot) {
    case 'timer-active':
      await prepareActiveTimerScenario();
      await useContractionStore.getState().hydrate();
      router.replace('/timer');
      return;
    case 'rhythm':
      await prepareEndedScenario(GETTING_CLOSER_STORY);
      await useContractionStore.getState().hydrate();
      router.replace('/rhythm');
      return;
    case 'call-rule':
      await prepareEndedScenario(REGULAR_STORY);
      await useContractionStore.getState().hydrate();
      router.replace('/timer');
      return;
    case 'history':
      await prepareEndedScenario(REGULAR_STORY);
      await useContractionStore.getState().hydrate();
      router.replace('/history');
      return;
    case 'share':
      await prepareEndedScenario(REGULAR_STORY);
      await useContractionStore.getState().hydrate();
      router.replace({ pathname: '/share', params: { preview: '1' } });
      return;
  }
}

type StoryEvent = {
  startOffsetMinutes: number;
  durationSeconds: number;
  intensity: Intensity;
  note?: string;
};

const TIMER_STORY: StoryEvent[] = [
  { startOffsetMinutes: -34, durationSeconds: 50, intensity: 'mild' },
  { startOffsetMinutes: -25.5, durationSeconds: 55, intensity: 'moderate' },
  { startOffsetMinutes: -18, durationSeconds: 58, intensity: 'moderate', note: 'Breathing helped.' },
  { startOffsetMinutes: -11.5, durationSeconds: 62, intensity: 'strong' },
];

const GETTING_CLOSER_STORY: StoryEvent[] = [
  { startOffsetMinutes: -70, durationSeconds: 48, intensity: 'mild' },
  { startOffsetMinutes: -60.5, durationSeconds: 52, intensity: 'mild' },
  { startOffsetMinutes: -52, durationSeconds: 55, intensity: 'moderate' },
  { startOffsetMinutes: -44.5, durationSeconds: 58, intensity: 'moderate', note: 'Rested between contractions.' },
  { startOffsetMinutes: -38, durationSeconds: 60, intensity: 'moderate' },
  { startOffsetMinutes: -32.5, durationSeconds: 62, intensity: 'strong' },
  { startOffsetMinutes: -27.5, durationSeconds: 64, intensity: 'strong' },
  { startOffsetMinutes: -22.8, durationSeconds: 65, intensity: 'strong', note: 'Needed focused breathing.' },
  { startOffsetMinutes: -18.3, durationSeconds: 66, intensity: 'strong' },
  { startOffsetMinutes: -14, durationSeconds: 68, intensity: 'strong' },
];

const REGULAR_STORY: StoryEvent[] = [
  { startOffsetMinutes: -50, durationSeconds: 63, intensity: 'moderate' },
  { startOffsetMinutes: -45, durationSeconds: 61, intensity: 'moderate' },
  { startOffsetMinutes: -40, durationSeconds: 65, intensity: 'moderate', note: 'Walking helped.' },
  { startOffsetMinutes: -35, durationSeconds: 64, intensity: 'moderate' },
  { startOffsetMinutes: -30, durationSeconds: 66, intensity: 'strong' },
  { startOffsetMinutes: -25, durationSeconds: 62, intensity: 'strong', note: 'Back pressure.' },
  { startOffsetMinutes: -20, durationSeconds: 67, intensity: 'strong' },
  { startOffsetMinutes: -15, durationSeconds: 64, intensity: 'strong' },
  { startOffsetMinutes: -10, durationSeconds: 68, intensity: 'strong', note: 'Changed positions.' },
  { startOffsetMinutes: -5, durationSeconds: 65, intensity: 'strong' },
];

async function prepareActiveTimerScenario() {
  await prepareEndedScenario(TIMER_STORY);
  const repo = await getAppRepository();
  await repo.startContraction(new Date(Date.now() - 58_000).toISOString());
}

async function prepareEndedScenario(events: StoryEvent[]) {
  const repo = await getAppRepository();
  const at = new Date().toISOString();
  await repo.deleteAllData(at);
  await repo.saveProfile(
    {
      emergencyPhone: '911',
      gestationalAgeAtSetupDays: 39 * 7,
      region: 'US',
      highRiskOrCallEarly: false,
      plannedCesarean: false,
    },
    at,
  );
  await repo.saveProviderRule(
    {
      intervalSecondsMax: 5 * 60,
      durationSecondsMin: 60,
      observationWindowMinutes: 60,
      label: '5-1-1',
      actionText: '',
      source: 'app_default',
    },
    at,
  );
  let snapshot: AppSnapshot | undefined;
  for (const event of events) {
    const startAt = new Date(Date.now() + event.startOffsetMinutes * 60_000).toISOString();
    const endAt = new Date(new Date(startAt).getTime() + event.durationSeconds * 1000).toISOString();
    snapshot = await repo.addMissedEvent(startAt, endAt, at);
    const added = snapshot.events.find((item) => item.startAt === startAt && item.endAt === endAt);
    if (added) {
      snapshot = await repo.updateEvent(added.id, { intensity: event.intensity, note: event.note }, at);
    }
  }
}
