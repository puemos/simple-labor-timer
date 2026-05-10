import { ContractionEvent } from '@/domain/types';
import { parseIso } from '@/domain/timing/timeMath';

export const SESSION_INACTIVITY_GAP_SECONDS = 2 * 60 * 60;

export function shouldStartNewSessionAfterGap(
  previousEvent: Pick<ContractionEvent, 'endAt'> | undefined,
  nextStartAt: string,
): boolean {
  if (!previousEvent?.endAt) {
    return false;
  }
  return parseIso(nextStartAt) - parseIso(previousEvent.endAt) >= SESSION_INACTIVITY_GAP_SECONDS * 1000;
}
