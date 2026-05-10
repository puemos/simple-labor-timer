import * as Haptics from 'expo-haptics';

async function safely(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    // Haptics are progressive enhancement; timing must still work when unavailable.
  }
}

export function hapticStart(): Promise<void> {
  return safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function hapticEnd(): Promise<void> {
  return safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticWarning(): Promise<void> {
  return safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function hapticSelection(): Promise<void> {
  return safely(() => Haptics.selectionAsync());
}

export function hapticImpactLight(): Promise<void> {
  return safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
