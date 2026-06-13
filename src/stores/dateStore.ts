// ============================================================
// Date Store - Shared selected date for screen headers
// ============================================================

import { create } from 'zustand';

function getTodayDateKey(): string {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

interface DateState {
  selectedDateKey: string;
  setSelectedDateKey: (dateKey: string | ((current: string) => string)) => void;
  resetSelectedDateKey: () => void;
}

export const useDateStore = create<DateState>((set) => ({
  selectedDateKey: getTodayDateKey(),
  setSelectedDateKey: (dateKey) =>
    set((state) => ({
      selectedDateKey: typeof dateKey === 'function' ? dateKey(state.selectedDateKey) : dateKey,
    })),
  resetSelectedDateKey: () => set({ selectedDateKey: getTodayDateKey() }),
}));
