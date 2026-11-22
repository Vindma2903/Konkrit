import { currentToken } from './token';
import {
  ApiError,
  ROLES,
  type AccessRequest,
  type House,
  type MemberFilters,
  type Permission,
  type RolesMatrix,
  type StaffAdminApi,
  type StaffAuthApi,
  type StaffMember,
  type StaffSession,
} from './types';

/**
 * Мок авторизации и администрирования сотрудников для разработки без бэкенда. Только для режима
 * разработки: в релизный бандл не попадает (см. main.ts). Сотрудники, заявки и права лежат в одном
 * хранилище, поэтому заявка из формы регистрации видна администратору, а подтверждённый
 * сотрудник входит с выданной ролью.
 *
 * Тестовые учётные записи (пароль у всех Password1):
 *  - manager@uk.ru    — Руководитель (администратор УК): заявки на доступ, сотрудники, роли и права
 *  - dispatcher@uk.ru — Диспетчер
 *  - engineer@uk.ru   — Инженер/куратор
 *  - executor@uk.ru   — Исполнитель
 *  - pending@uk.ru    — заявка ждёт подтверждения (есть ещё new1@uk.ru)
 *  - rejected@uk.ru   — заявка отклонена
 *  - blocked@uk.ru    — доступ закрыт
 *  - limited@uk.ru    — слишком много попыток (на 2 минуты)
 *  - offline@uk.ru    — нет соединения
 * Регистрация: taken@uk.ru — почта занята; любая новая почта создаёт заявку для manager@uk.ru.
 * Ссылка восстановления: token=demo действует один раз, остальные — недействительны.
 */
export const MOCK_PASSWORD = 'Password1';
const COMPANY = 'УК «Тест-Сервис»';
const ADMIN_EMAIL = 'manager@uk.ru';
const FLAG = 'mock-staff-session';
const STORE_KEY = 'mock-staff-store-v1';

const STATUSES: StaffMember['status'][] = ['active', 'vacation', 'disabled'];

const ALL: Permission[] = [
  'requests.create',
  'requests.assign',
  'requests.status',
  'acts.use',
  'acts.templates',
  'analytics.view',
  'directories.manage',
  'staff.manage',
  'contractors.manage',
];

const initialMatrix = (): RolesMatrix => ({
  dispatcher: ['requests.create', 'requests.assign', 'requests.status', 'acts.use'],
  engineer: [
    'requests.create',
    'requests.assign',
    'requests.status',
    'acts.use',
    'analytics.view',
    'contractors.manage',
  ],
  executor: ['requests.status', 'acts.use'],
  manager: [...ALL],
});

const HOUSES: House[] = [
  { id: 'house-1', title: 'ул. Тестовая, д. 1' },
  { id: 'house-2', title: 'ул. Образцовая, д. 12' },
  { id: 'house-3', title: 'ул. Образцовая, д. 14, корп. 2' },
  { id: 'area-1', title: 'Участок: двор и парковка' },
];

type StoredMember = StaffMember & { password: string };
type StoredRequest = AccessRequest & { password: string };
type State = {
  members: StoredMember[];
  requests: StoredRequest[];
  matrix: RolesMatrix;
  counter: number;
  /** Письма «доступ открыт» (мок их не отправляет, только запоминает). */
  mails: string[];
};

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function initialState(): State {
  const member = (
    id: string,
    name: string,
    email: string,
    phone: string,
    role: StaffMember['role'],
    houseIds: string[] | 'all',
    status: StaffMember['status'] = 'active',
  ): StoredMember => ({
    id,
    name,
    email,
    phone,
    role,
    scope: houseIds === 'all' ? { all: true, houseIds: [] } : { all: false, houseIds },
    status,
    password: MOCK_PASSWORD,
  });
  const request = (
    id: string,
    name: string,
    email: string,
    phone: string,
    minutes: number,
    status: AccessRequest['status'] = 'pending',
  ): StoredRequest => ({
    id,
    name,
    email,
    phone,
    company: COMPANY,
    createdAt: ago(minutes),
    status,
    password: MOCK_PASSWORD,
  });
  return {
    members: [
      member('staff-1', 'Мария Воронина', 'manager@uk.ru', '+7 900 111-22-33', 'manager', 'all'),
      member('staff-2', 'Анна Соколова', 'dispatcher@uk.ru', '+7 900 222-33-44', 'dispatcher', 'all'),
      member('staff-3', 'Павел Громов', 'engineer@uk.ru', '+7 900 333-44-55', 'engineer', ['house-1', 'house-2']),
      member('staff-4', 'Сергей Петров', 'executor@uk.ru', '+7 900 444-55-66', 'executor', ['area-1']),
      member('staff-5', 'Ольга Кузнецова', 'executor2@uk.ru', '+7 900 555-66-77', 'executor', ['area-1'], 'vacation'),
      member('staff-6', 'Игорь Лебедев', 'blocked@uk.ru', '+7 900 666-77-88', 'dispatcher', 'all', 'disabled'),
    ],
    requests: [
      request('request-1', 'Иван Новиков', 'pending@uk.ru', '+7 900 777-88-99', 90),
      request('request-2', 'Дарья Белова', 'new1@uk.ru', '+7 900 888-99-00', 2000),
      request('request-3', 'Роман Крылов', 'rejected@uk.ru', '+7 900 999-00-11', 5000, 'rejected'),
    ],
    matrix: initialMatrix(),
    counter: 10,
    mails: [],
  };
}

const delay = (ms: number) =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function load(persist: boolean): State {
  if (persist) {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw) as State;
    } catch {
      // повреждённое хранилище мока — начинаем с начальных данных
    }
  }
  return initialState();
}

function readFlag(storage: Storage): string | null {
  try {
    const raw = storage.getItem(FLAG);
    const value = raw ? (JSON.parse(raw) as { id?: unknown }) : null;
    return typeof value?.id === 'string' ? value.id : null;
  } catch {
    return null;
  }
}

function writeFlag(storage: Storage, id: string) {
  try {
    storage.setItem(FLAG, JSON.stringify({ id }));
  } catch {
    // хранилище недоступно: сессия не переживёт перезагрузку
  }
}

function clearFlag() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      storage.removeItem(FLAG);
    } catch {
      // нечего очищать
    }
  }
}

export type MockStaff = {
  auth: StaffAuthApi;
  admin: StaffAdminApi;
  /** Письма «доступ открыт», которые мок «отправил». Нужны тестам. */
  mails: () => readonly string[];
  /** Прямой доступ к данным для проверок. */
  state: () => State;
};

export function createMockStaff({
  latencyMs = 400,
  persist = false,
}: { latencyMs?: number; persist?: boolean } = {}): MockStaff {
  const state = load(persist);
  // Другая вкладка могла изменить хранилище: перед каждым вызовом перечитываем его
  const sync = () => {
    if (persist) Object.assign(state, load(true));
  };
  const begin = async (ms = latencyMs) => {
    await delay(ms);
    sync();
  };
  const tokens = new Map<string, string>();
  const usedTokens = new Set<string>();
  let tokenCounter = 0;

  const save = () => {
    if (!persist) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      // без хранилища данные живут до перезагрузки
    }
  };
  // Первое обращение: сохраняем начальные данные, чтобы другая вкладка видела те же записи
  if (persist && !localStorage.getItem(STORE_KEY)) save();
  const nextId = (prefix: string) => `${prefix}-${(state.counter += 1)}`;

  // Пароль мока наружу не отдаётся
  const publicMember = (member: StoredMember): StaffMember => {
    const copy: Partial<StoredMember> = clone(member);
    delete copy.password;
    return copy as StaffMember;
  };
  const publicRequest = (request: StoredRequest): AccessRequest => {
    const copy: Partial<StoredRequest> = clone(request);
    delete copy.password;
    return copy as AccessRequest;
  };

  const sessionFor = (member: StoredMember): StaffSession => {
    tokenCounter += 1;
    const accessToken = `mock-access-${tokenCounter}`;
    tokens.set(accessToken, member.id);
    return {
      accessToken,
      user: {
        id: member.id,
        name: member.name,
        role: member.role,
        permissions: [...state.matrix[member.role]],
      },
    };
  };

  /** Кто вызывает: по токену сессии; отключённый или неизвестный — как просроченный токен. */
  const caller = (): StoredMember => {
    const token = currentToken();
    const id = token ? tokens.get(token) : undefined;
    const member = state.members.find((item) => item.id === id);
    if (!member || member.status === 'disabled') throw new ApiError('unauthorized');
    return member;
  };

  const requireStaffManage = (): StoredMember => {
    const member = caller();
    if (!state.matrix[member.role].includes('staff.manage')) throw new ApiError('forbidden');
    return member;
  };

  const emailTaken = (email: string) =>
    state.members.some((item) => item.email === email) || state.requests.some((item) => item.email === email);

  const activeManagers = () =>
    state.members.filter((item) => item.role === 'manager' && item.status !== 'disabled');

  const auth: StaffAuthApi = {
    async login({ email, password, remember }) {
      await begin();
      const key = email.trim().toLowerCase();
      if (key === 'offline@uk.ru') throw new ApiError('network');
      if (key === 'limited@uk.ru') throw new ApiError('rate_limited', { retryAfterSec: 120 });
      const member = state.members.find((item) => item.email === key);
      const request = state.requests.find((item) => item.email === key);
      const account = member ?? request;
      if (!account || account.password !== password) throw new ApiError('invalid_credentials');
      if (member) {
        if (member.status === 'disabled') throw new ApiError('blocked');
        writeFlag(remember ? localStorage : sessionStorage, member.id);
        return sessionFor(member);
      }
      if (request?.status === 'rejected') throw new ApiError('rejected');
      throw new ApiError('pending_approval', { fields: { company: COMPANY, adminEmail: ADMIN_EMAIL } });
    },

    async register({ name, email, phone, password, company }) {
      await begin();
      const key = email.trim().toLowerCase();
      if (key === 'offline@uk.ru') throw new ApiError('network');
      if (key === 'taken@uk.ru' || emailTaken(key)) throw new ApiError('email_taken');
      state.requests.push({
        id: nextId('request'),
        name,
        email: key,
        phone,
        company: company || COMPANY,
        createdAt: new Date().toISOString(),
        status: 'pending',
        password,
      });
      save();
      return { company: COMPANY, adminEmail: ADMIN_EMAIL };
    },

    async refresh() {
      await begin(Math.min(latencyMs, 100));
      const id = readFlag(localStorage) ?? readFlag(sessionStorage);
      const member = state.members.find((item) => item.id === id);
      // Отключённый или неизвестный сотрудник (в том числе запись прежнего формата) — вход заново
      if (!member || member.status === 'disabled') throw new ApiError('unauthorized');
      return sessionFor(member);
    },

    async logout(accessToken) {
      await begin(Math.min(latencyMs, 100));
      // Токен выхода отзывается: серверный образец не оставляет живых сессий
      if (accessToken) tokens.delete(accessToken);
      clearFlag();
    },

    async forgotPassword({ email }) {
      await begin();
      const key = email.trim().toLowerCase();
      if (key === 'offline@uk.ru') throw new ApiError('network');
      if (key === 'limited@uk.ru') throw new ApiError('rate_limited', { retryAfterSec: 120 });
      return { retryAfterSec: 30, ttlMin: 30 };
    },

    async resetPassword({ token }) {
      await begin();
      if (token !== 'demo' || usedTokens.has(token)) throw new ApiError('invalid_token');
      usedTokens.add(token);
    },
  };

  const admin: StaffAdminApi = {
    async listAccessRequests(status) {
      await begin();
      requireStaffManage();
      const items = state.requests
        .filter((item) => item.status === status)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map(publicRequest);
      return { items, pendingCount: state.requests.filter((item) => item.status === 'pending').length };
    },

    async approveAccessRequest(id, { role, scope, notify }) {
      await begin();
      requireStaffManage();
      const index = state.requests.findIndex((item) => item.id === id);
      // Заявки нет среди ожидающих и отклонённых: её уже подтвердил другой администратор
      if (index < 0) throw new ApiError('already_processed', { fields: { status: 'approved' } });
      if (!scope.all && scope.houseIds.length === 0) {
        throw new ApiError('validation', { fields: { scope: 'Выберите хотя бы один дом или участок' } });
      }
      const request = state.requests[index]!;
      state.requests.splice(index, 1);
      state.members.push({
        id: nextId('staff'),
        name: request.name,
        email: request.email,
        phone: request.phone,
        role,
        scope: clone(scope),
        status: 'active',
        password: request.password,
      });
      if (notify) state.mails.push(request.email);
      save();
    },

    async rejectAccessRequest(id) {
      await begin();
      requireStaffManage();
      const request = state.requests.find((item) => item.id === id);
      if (!request) throw new ApiError('already_processed', { fields: { status: 'approved' } });
      if (request.status === 'rejected') {
        throw new ApiError('already_processed', { fields: { status: 'rejected' } });
      }
      request.status = 'rejected';
      save();
    },

    async listMembers({ query, role, houseId, status }: MemberFilters = {}) {
      await begin();
      requireStaffManage();
      const needle = query?.trim().toLowerCase();
      return state.members
        .filter((item) => {
          if (needle && !`${item.name} ${item.phone} ${item.email}`.toLowerCase().includes(needle)) return false;
          if (role && item.role !== role) return false;
          if (status && item.status !== status) return false;
          if (houseId && !item.scope.all && !item.scope.houseIds.includes(houseId)) return false;
          return true;
        })
        .map(publicMember);
    },

    async updateMember(id, patch) {
      await begin();
      const me = requireStaffManage();
      const member = state.members.find((item) => item.id === id);
      if (!member) throw new ApiError('not_found');
      if (patch.status === 'disabled' && member.id === me.id) {
        throw new ApiError('validation', { fields: { status: 'Нельзя отключить себя' } });
      }
      const losesManager =
        member.role === 'manager' &&
        ((patch.role !== undefined && patch.role !== 'manager') || patch.status === 'disabled');
      if (losesManager && activeManagers().length <= 1 && member.status !== 'disabled') {
        throw new ApiError('last_manager');
      }
      if (patch.scope && !patch.scope.all && patch.scope.houseIds.length === 0) {
        throw new ApiError('validation', { fields: { scope: 'Выберите хотя бы один дом или участок' } });
      }
      if (patch.role && !ROLES.some((item) => item.key === patch.role)) {
        throw new ApiError('validation', { fields: { role: 'Неизвестная роль' } });
      }
      if (patch.status && !STATUSES.includes(patch.status)) {
        throw new ApiError('validation', { fields: { status: 'Неизвестный статус' } });
      }
      if (patch.role) member.role = patch.role;
      if (patch.scope) member.scope = clone(patch.scope);
      if (patch.status) member.status = patch.status;
      save();
    },

    async getRoles() {
      await begin();
      requireStaffManage();
      return clone(state.matrix);
    },

    async saveRoles(matrix) {
      await begin();
      requireStaffManage();
      // Серверу нужна полная матрица: все роли и только известные права
      const complete = ROLES.every((role) => Array.isArray(matrix[role.key]) && matrix[role.key].every((p) => ALL.includes(p)));
      if (!complete) throw new ApiError('validation', { fields: { matrix: 'Неполная матрица прав' } });
      if (!matrix.manager.includes('staff.manage')) {
        throw new ApiError('validation', { fields: { matrix: 'Руководитель должен управлять сотрудниками' } });
      }
      state.matrix = clone(matrix);
      save();
    },

    async listHouses() {
      await begin();
      requireStaffManage();
      return clone(HOUSES);
    },
  };

  return { auth, admin, mails: () => state.mails, state: () => state };
}

/** Только авторизация: прежняя точка входа для тестов экранов входа. */
export function createMockAuthApi(options: { latencyMs?: number } = {}): StaffAuthApi {
  return createMockStaff(options).auth;
}
