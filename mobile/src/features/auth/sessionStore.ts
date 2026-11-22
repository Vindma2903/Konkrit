import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { User } from '@/api';
import { useOnboardingStore } from '@/features/onboarding/onboardingStore';
import { useRequestDraft } from '@/features/requests/draftStore';
import { queryClient } from '@/lib/queryClient';

import { useLoginDraft } from './loginDraftStore';

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

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Проверка формы сохранённого значения: повреждённая запись не должна считаться входом. */
function isPersisted(value: unknown): value is Persisted {
  if (typeof value !== 'object' || value === null) return false;
  const { tokens, user, hasResidency } = value as Record<string, unknown>;
  if (typeof tokens !== 'object' || tokens === null) return false;
  const { accessToken, refreshToken } = tokens as Record<string, unknown>;
  return (
    isString(accessToken) &&
    isString(refreshToken) &&
    typeof user === 'object' &&
    user !== null &&
    isString((user as Record<string, unknown>).id) &&
    typeof hasResidency === 'boolean'
  );
}

async function persist(value: Persisted | null) {
  if (value) await SecureStore.setItemAsync(KEY, JSON.stringify(value));
  else await SecureStore.deleteItemAsync(KEY);
}

/**
 * Запись в защищённое хранилище может не удаться (нет доступа, переполнение). Тогда сессия
 * живёт в памяти до перезапуска, а вход не считается проваленным: на сервере он уже состоялся.
 */
async function persistQuietly(value: Persisted | null) {
  try {
    await persist(value);
  } catch {
    // Сессия остаётся в памяти.
  }
}

/** Данные предыдущего жителя не должны достаться следующему на этом устройстве. */
function clearUserData() {
  useRequestDraft.getState().reset();
  useOnboardingStore.getState().reset();
  useLoginDraft.getState().reset();
  queryClient.clear();
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
        const saved: unknown = JSON.parse(raw);
        if (isPersisted(saved)) {
          set({ tokens: saved.tokens, user: saved.user, hasResidency: saved.hasResidency });
        } else {
          await SecureStore.deleteItemAsync(KEY);
        }
      }
    } catch {
      // Повреждённое хранилище: начинаем без сессии.
      await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
    } finally {
      set({ hydrated: true });
    }
  },

  async signIn({ tokens, user, hasResidency }) {
    set({ tokens, user, hasResidency });
    await persistQuietly({ tokens, user, hasResidency });
  },

  async markResidency() {
    const { tokens, user } = get();
    set({ hasResidency: true });
    if (tokens && user) await persistQuietly({ tokens, user, hasResidency: true });
  },

  async signOut() {
    set({ tokens: null, user: null, hasResidency: false });
    clearUserData();
    await persistQuietly(null);
  },
}));
