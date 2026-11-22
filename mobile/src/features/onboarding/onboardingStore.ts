import { create } from 'zustand';

import type { House, ResidencyRole, Verification } from '@/api';

type Form = {
  apartment: string;
  account: string;
  role: ResidencyRole;
  verification: Verification;
};

type OnboardingState = Form & {
  house: House | null;
  /** Выбор дома; при смене дома поля привязки очищаются. */
  selectHouse: (house: House) => void;
  setField: <K extends keyof Form>(key: K, value: Form[K]) => void;
  reset: () => void;
};

const emptyForm: Form = { apartment: '', account: '', role: 'owner', verification: 'receipt' };

/** Шаги онбординга: выбранный дом и введённое на привязке, чтобы «Назад» ничего не стирал. */
export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  house: null,
  ...emptyForm,
  selectHouse(house) {
    if (get().house?.id === house.id) return;
    set({ house, ...emptyForm });
  },
  setField(key, value) {
    set({ [key]: value } as Pick<Form, typeof key>);
  },
  reset: () => set({ house: null, ...emptyForm }),
}));
