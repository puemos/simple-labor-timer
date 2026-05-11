import { useEffect } from 'react';
import { create } from 'zustand';
import { nowIso } from '@/domain/timing/timeMath';

type ClockState = {
  now: string;
  subscribers: number;
  tick: () => void;
  subscribe: () => void;
  unsubscribe: () => void;
};

let intervalHandle: ReturnType<typeof setInterval> | undefined;

export const useClockStore = create<ClockState>((set, get) => ({
  now: nowIso(),
  subscribers: 0,
  tick: () => set({ now: nowIso() }),
  subscribe: () => {
    const next = get().subscribers + 1;
    set({ subscribers: next });
    if (next === 1 && intervalHandle === undefined) {
      intervalHandle = setInterval(() => get().tick(), 1_000);
    }
  },
  unsubscribe: () => {
    const next = Math.max(0, get().subscribers - 1);
    set({ subscribers: next });
    if (next === 0 && intervalHandle !== undefined) {
      clearInterval(intervalHandle);
      intervalHandle = undefined;
    }
  },
}));

export function useClock(active: boolean): string {
  const now = useClockStore((state) => state.now);

  useEffect(() => {
    if (!active) {
      return;
    }
    const { subscribe, unsubscribe } = useClockStore.getState();
    subscribe();
    return () => {
      unsubscribe();
    };
  }, [active]);

  return now;
}
