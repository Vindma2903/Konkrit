import { create } from 'zustand';

export type CreatedRequestSummary = {
  id: string;
  number: number;
  createdAt: string;
  categoryName: string;
  address: string;
  answerWithinMin: number;
};

type CreatedRequestState = {
  summary: CreatedRequestSummary | null;
  setSummary: (summary: CreatedRequestSummary | null) => void;
};

/** Итог последней созданной заявки для экрана «Заявка создана». В память, не на диск. */
export const useCreatedRequest = create<CreatedRequestState>((set) => ({
  summary: null,
  setSummary: (summary) => set({ summary }),
}));

/** Сбросить итог (выход из аккаунта). */
export function createdRequestReset() {
  useCreatedRequest.getState().setSummary(null);
}
