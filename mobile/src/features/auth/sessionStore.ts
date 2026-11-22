import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { User } from '@/api';
import { useOnboardingStore } from '@/features/onboarding/onboardingStore';
import { createdRequestReset } from '@/features/requests/createdRequestStore';
import { discardDraft } from '@/features/requests/uploader';
import { queryClient } from '@/lib/queryClient';

import { useLoginDraft } from './loginDraftStore';

/** Токены и профиль лежат в разных ключах: у iOS-хранилища лимит на размер значения (около 2 КБ). */
const KEYS = {
  access: 'konkrit.access',
  refresh: 'konkrit.refresh',
  profile: 'konkrit.profile',
} as const;

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
  if (value) {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.access, value.tokens.accessToken),
      SecureStore.setItemAsync(KEYS.refresh, value.tokens.refreshToken),
      SecureStore.setItemAsync(
        KEYS.profile,
        JSON.stringify({ user: value.user, hasResidency: value.hasResidency }),
      ),
    ]);
  } else {
    await clearStored();
  }
}

async function clearStored() {
  await Promise.all(Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key)));
}

/** Читает сессию из трёх ключей; null, если её нет или запись повреждена. */
async function readStored(): Promise<Persisted | null> {
  const [accessToken, refreshToken, profile] = await Promise.all([
    SecureStore.getItemAsync(KEYS.access),
    SecureStore.getItemAsync(KEYS.refresh),
    SecureStore.getItemAsync(KEYS.profile),
  ]);
  if (accessToken === null && refreshToken === null && profile === null) return null;
  const saved: unknown = {
    tokens: { accessToken, refreshToken },
    ...(profile ? (JSON.parse(profile) as object) : {}),
  };
  if (isPersisted(saved)) return saved;
  // Неполная или повреждённая запись не считается входом и стирается.
  await clearStored();
  return null;
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
function clearUserData(): Promise<void> {
  const draftCleared = discardDraft();
  createdRequestReset();
  useOnboardingStore.getState().reset();
  useLoginDraft.getState().reset();
  queryClient.clear();
  return draftCleared;
}

/** Сессия жителя: токены лежат в защищённом хранилище, не в обычном. */
export const useSessionStore = create<SessionState>((set, get) => ({
  hydrated: false,
  tokens: null,
  user: null,
  hasResidency: false,

  async hydrate() {
    try {
      const saved = await readStored();
      if (saved) {
        set({ tokens: saved.tokens, user: saved.user, hasResidency: saved.hasResidency });
      }
    } catch {
      // Повреждённое хранилище: начинаем без сессии.
      await clearStored().catch(() => undefined);
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
    const userDataCleared = clearUserData();
    await persistQuietly(null);
    // Приложение могут закрыть сразу после выхода: ждём, пока черновик стёрт с диска.
    await userDataCleared;
  },
}));
