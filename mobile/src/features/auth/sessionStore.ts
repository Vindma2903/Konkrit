import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { User } from '@/api';

const KEY = 'konkrit.session';

type Tokens = { accessToken: string; refreshToken: string };

type SessionState = {
  /** Хранилище прочитано при запуске. */
  hydrated: boolean;
  tokens: Tokens | null;
  user: User | null;
  /** Есть ли у жителя привязка квартиры (хотя бы на подтверждении). */
  hasResidency: boolean;
  hydrate: () => Promise<void>;
  signIn: (session: { tokens: Tokens; user: User; hasResidency: boolean }) => Promise<void>;
  markResidency: () => Promise<void>;
  signOut: () => Promise<void>;
};

type Persisted = { tokens: Tokens; user: User; hasResidency: boolean };

async function persist(value: Persisted | null) {
  if (value) await SecureStore.setItemAsync(KEY, JSON.stringify(value));
  else await SecureStore.deleteItemAsync(KEY);
}

/** Сессия жителя: токены лежат в защищённом хранилище, не в обычном. */
export const useSessionStore = create<SessionState>((set, get) => ({
  hydrated: false,
  tokens: null,
  user: null,
  hasResidency: false,

  async hydrate() {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Persisted;
        set({ tokens: saved.tokens, user: saved.user, hasResidency: saved.hasResidency });
      }
    } catch {
      // Повреждённое хранилище: начинаем без сессии.
      await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
    } finally {
      set({ hydrated: true });
    }
  },

  async signIn({ tokens, user, hasResidency }) {
    await persist({ tokens, user, hasResidency });
    set({ tokens, user, hasResidency });
  },

  async markResidency() {
    const { tokens, user } = get();
    set({ hasResidency: true });
    if (tokens && user) await persist({ tokens, user, hasResidency: true });
  },

  async signOut() {
    await persist(null);
    set({ tokens: null, user: null, hasResidency: false });
  },
}));
