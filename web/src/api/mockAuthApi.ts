import {
  ApiError,
  type StaffAuthApi,
  type StaffSession,
  type StaffUser,
} from './types';

/**
 * Мок авторизации сотрудников для разработки без бэкенда. Только для режима разработки:
 * в релизный бандл не попадает (см. main.ts).
 *
 * Тестовые учётные записи (пароль у всех Password1):
 *  - dispatcher@uk.ru — вход выполняется (диспетчер)
 *  - employee@uk.ru   — вход выполняется (сотрудник)
 *  - pending@uk.ru    — ждёт подтверждения администратором
 *  - rejected@uk.ru   — доступ отклонён
 *  - blocked@uk.ru    — доступ закрыт
 *  - limited@uk.ru    — слишком много попыток (на 2 минуты)
 *  - offline@uk.ru    — нет соединения
 * Регистрация: taken@uk.ru — почта занята. Восстановление: limited@uk.ru — лимит.
 * Ссылка восстановления: token=demo действует один раз, остальные — недействительны.
 */
export const MOCK_PASSWORD = 'Password1';
const COMPANY = 'УК «Тест-Сервис»';
const ADMIN_EMAIL = 'admin@uk.ru';
const FLAG = 'mock-staff-session';

const USERS: Record<string, StaffUser> = {
  'dispatcher@uk.ru': { id: 'staff-1', name: 'Анна Соколова', role: 'dispatcher' },
  'employee@uk.ru': { id: 'staff-2', name: 'Павел Громов', role: 'employee' },
};

const delay = (ms: number) => (ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

function read(storage: Storage): StaffUser | null {
  try {
    const raw = storage.getItem(FLAG);
    return raw ? (JSON.parse(raw) as StaffUser) : null;
  } catch {
    return null;
  }
}

function write(storage: Storage, user: StaffUser) {
  try {
    storage.setItem(FLAG, JSON.stringify(user));
  } catch {
    // хранилище недоступно: сессия не переживёт перезагрузку
  }
}

function clear() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      storage.removeItem(FLAG);
    } catch {
      // нечего очищать
    }
  }
}

export function createMockAuthApi({ latencyMs = 400 }: { latencyMs?: number } = {}): StaffAuthApi {
  const registered = new Set<string>();
  const usedTokens = new Set<string>();
  let counter = 0;

  const session = (user: StaffUser): StaffSession => {
    counter += 1;
    return { accessToken: `mock-access-${counter}`, user };
  };

  return {
    async login({ email, password, remember }) {
      await delay(latencyMs);
      const key = email.trim().toLowerCase();
      if (key === 'offline@uk.ru') throw new ApiError('network');
      if (key === 'limited@uk.ru') throw new ApiError('rate_limited', { retryAfterSec: 120 });
      if (password !== MOCK_PASSWORD) throw new ApiError('invalid_credentials');
      if (key === 'pending@uk.ru' || registered.has(key)) {
        throw new ApiError('pending_approval', { fields: { company: COMPANY, adminEmail: ADMIN_EMAIL } });
      }
      if (key === 'rejected@uk.ru') throw new ApiError('rejected');
      if (key === 'blocked@uk.ru') throw new ApiError('blocked');
      const user = USERS[key];
      if (!user) throw new ApiError('invalid_credentials');
      write(remember ? localStorage : sessionStorage, user);
      return session(user);
    },

    async register({ email }) {
      await delay(latencyMs);
      const key = email.trim().toLowerCase();
      if (key === 'offline@uk.ru') throw new ApiError('network');
      if (key === 'taken@uk.ru' || key in USERS || registered.has(key)) throw new ApiError('email_taken');
      registered.add(key);
      return { company: COMPANY, adminEmail: ADMIN_EMAIL };
    },

    async refresh() {
      await delay(Math.min(latencyMs, 100));
      const user = read(localStorage) ?? read(sessionStorage);
      if (!user) throw new ApiError('unauthorized');
      return session(user);
    },

    async logout() {
      await delay(Math.min(latencyMs, 100));
      clear();
    },

    async forgotPassword({ email }) {
      await delay(latencyMs);
      const key = email.trim().toLowerCase();
      if (key === 'offline@uk.ru') throw new ApiError('network');
      if (key === 'limited@uk.ru') throw new ApiError('rate_limited', { retryAfterSec: 120 });
      return { retryAfterSec: 30, ttlMin: 30 };
    },

    async resetPassword({ token }) {
      await delay(latencyMs);
      if (token !== 'demo' || usedTokens.has(token)) throw new ApiError('invalid_token');
      usedTokens.add(token);
    },
  };
}
