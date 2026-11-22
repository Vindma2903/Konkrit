import { create } from 'zustand';

import type { Category } from '@/api';

type DraftState = {
  category: Category | null;
  description: string;
  setCategory: (category: Category | null) => void;
  setDescription: (description: string) => void;
  reset: () => void;
};

/** Черновик заявки на время сессии: «Назад» не стирает введённое. */
export const useRequestDraft = create<DraftState>((set) => ({
  category: null,
  description: '',
  setCategory: (category) => set({ category }),
  setDescription: (description) => set({ description }),
  reset: () => set({ category: null, description: '' }),
}));
