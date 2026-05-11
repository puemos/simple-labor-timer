import { Linking } from 'react-native';
import { router } from 'expo-router';

export function callNumber(phone?: string) {
  if (!phone) {
    router.push('/settings');
    return;
  }
  void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
}

export function formatActiveDuration(startAt: string | undefined, now: string): number {
  if (!startAt) {
    return 0;
  }
  return Math.max(0, Math.round((Date.parse(now) - Date.parse(startAt)) / 1000));
}
