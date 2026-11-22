import { create } from 'zustand';

import type { Channel } from '@/api';

type LoginDraft = {
  channel: Channel;
  /** Текст в поле телефона (с маской). */
  phone: string;
  email: string;
  setChannel: (channel: Channel) => void;
  setPhone: (phone: string) => void;
  setEmail: (email: string) => void;
  reset: () => void;
};

const initial = { channel: 'phone' as Channel, phone: '', email: '' };

/** Введённое на экране входа: не теряется при переключении способа и возврате с экрана кода. */
export const useLoginDraft = create<LoginDraft>((set) => ({
  ...initial,
  setChannel: (channel) => set({ channel }),
  setPhone: (phone) => set({ phone }),
  setEmail: (email) => set({ email }),
  reset: () => set(initial),
}));
