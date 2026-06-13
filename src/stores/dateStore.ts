// ============================================================
// Date Store - Shared selected date for screen headers
// ============================================================

import { create } from 'zustand';
import { getLocalDateKey, getMillisecondsUntilNextLocalDay } from '../utils/dates';

interface DateState {
  selectedDateKey: string;
  setSelectedDateKey: (dateKey: string | ((current: string) => string)) => void;
  resetSelectedDateKey: () => void;
  rolloverToTodayIfNeeded: () => void;
}

export const useDateStore = create<DateState>((set) => ({
  selectedDateKey: getLocalDateKey(),
  setSelectedDateKey: (dateKey) =>
    set((state) => ({
      selectedDateKey: typeof dateKey === 'function' ? dateKey(state.selectedDateKey) : dateKey,
    })),
  resetSelectedDateKey: () => set({ selectedDateKey: getLocalDateKey() }),
  rolloverToTodayIfNeeded: () =>
    set((state) => {
      const today = getLocalDateKey();

      return state.selectedDateKey === today ? state : { selectedDateKey: today };
    }),
}));

export function scheduleDateRollover(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    timer = setTimeout(() => {
      useDateStore.getState().rolloverToTodayIfNeeded();
      schedule();
    }, getMillisecondsUntilNextLocalDay() + 1000);
  };

  schedule();

  return () => {
    if (timer) {
      clearTimeout(timer);
    }
  };
}
