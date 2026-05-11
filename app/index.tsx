import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { prepareScreenshotScenario } from '@/dev/screenshotScenarios';

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
  const route = await prepareScreenshotScenario(shot);
  if (route) {
    router.replace(route);
  }
}
