/** Роли макета «Роли и права». Руководитель — он же администратор УК. */
export type StaffRole = 'dispatcher' | 'engineer' | 'executor' | 'manager';

export const ROLES: readonly { key: StaffRole; title: string }[] = [
  { key: 'dispatcher', title: 'Диспетчер' },
  { key: 'engineer', title: 'Инженер/куратор' },
  { key: 'executor', title: 'Исполнитель' },
  { key: 'manager', title: 'Руководитель' },
];

export const roleTitle = (role: StaffRole) => ROLES.find((item) => item.key === role)?.title ?? role;

/** Права — строки матрицы «Роли и права». */
export type Permission =
  | 'requests.create'
  | 'requests.assign'
  | 'requests.status'
  | 'acts.use'
  | 'acts.templates'
  | 'analytics.view'
  | 'directories.manage'
  | 'staff.manage'
  | 'contractors.manage';

export const PERMISSIONS: readonly { key: Permission; title: string }[] = [
  { key: 'requests.create', title: 'Создавать заявки' },
  { key: 'requests.assign', title: 'Назначать исполнителей' },
  { key: 'requests.status', title: 'Менять статус заявки' },
  { key: 'acts.use', title: 'Работать с актами' },
  { key: 'acts.templates', title: 'Редактировать шаблоны актов' },
  { key: 'analytics.view', title: 'Видеть аналитику' },
  { key: 'directories.manage', title: 'Управлять справочниками' },
  { key: 'staff.manage', title: 'Управлять сотрудниками' },
  { key: 'contractors.manage', title: 'Управлять подрядчиками' },
];

export const permissionTitle = (key: Permission) =>
  PERMISSIONS.find((item) => item.key === key)?.title ?? key;

export type RolesMatrix = Record<StaffRole, Permission[]>;

export type StaffUser = {
  id: string;
  name: string;
  role: StaffRole;
  permissions: Permission[];
};

export type StaffSession = { accessToken: string; user: StaffUser };

export type LoginInput = { email: string; password: string; remember: boolean };

export type RegisterInput = {
  name: string;
  company: string;
  email: string;
  phone: string;
  password: string;
  consent: boolean;
};

export type RegisterResult = { company: string; adminEmail: string };

export type ForgotResult = { retryAfterSec: number; ttlMin: number };

export type ApiErrorCode =
  | 'invalid_credentials'
  | 'pending_approval'
  | 'rejected'
  | 'blocked'
  | 'rate_limited'
  | 'email_taken'
  | 'validation'
  | 'invalid_token'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'already_processed'
  | 'last_manager'
  | 'network'
  | 'unknown';

export type ApiErrorInit = {
  message?: string;
  retryAfterSec?: number;
  /** Сообщения по полям формы (validation) или данные заявки (pending_approval). */
  fields?: Record<string, string>;
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** Через сколько секунд повторить (rate_limited). */
  readonly retryAfterSec?: number;
  readonly fields?: Record<string, string>;

  constructor(code: ApiErrorCode, init: ApiErrorInit = {}) {
    super(init.message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.retryAfterSec = init.retryAfterSec;
    this.fields = init.fields;
  }
}

/** Контракт авторизации сотрудников УК (см. api/openapi.yaml, /staff/auth/*). */
export interface StaffAuthApi {
  login(input: LoginInput): Promise<StaffSession>;
  register(input: RegisterInput): Promise<RegisterResult>;
  /** Восстановить сессию по refresh-куке; без неё бросает ApiError('unauthorized'). */
  refresh(): Promise<StaffSession>;
  logout(accessToken: string | null): Promise<void>;
  forgotPassword(input: { email: string }): Promise<ForgotResult>;
  resetPassword(input: { token: string; password: string }): Promise<void>;
}

/* Администрирование сотрудников (право staff.manage) */

export type AccessRequestStatus = 'pending' | 'rejected';

export type AccessRequest = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  /** Время заявки, ISO 8601. */
  createdAt: string;
  status: AccessRequestStatus;
};

export type AccessRequestsPage = { items: AccessRequest[]; pendingCount: number };

export type House = { id: string; title: string };

/** Область работы: все дома или выбранные. */
export type Scope = { all: boolean; houseIds: string[] };

export type MemberStatus = 'active' | 'vacation' | 'disabled';

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  scope: Scope;
  status: MemberStatus;
};

export type MemberFilters = {
  query?: string;
  role?: StaffRole;
  houseId?: string;
  status?: MemberStatus;
  signal?: AbortSignal;
};

export type ApproveInput = { role: StaffRole; scope: Scope; notify: boolean };

export type MemberPatch = { role?: StaffRole; scope?: Scope; status?: MemberStatus };

/** Контракт администрирования (см. api/openapi.yaml, /staff/*). Токен берётся из сессии. */
export interface StaffAdminApi {
  listAccessRequests(status: AccessRequestStatus): Promise<AccessRequestsPage>;
  approveAccessRequest(id: string, input: ApproveInput): Promise<void>;
  rejectAccessRequest(id: string): Promise<void>;
  listMembers(filters?: MemberFilters): Promise<StaffMember[]>;
  updateMember(id: string, patch: MemberPatch): Promise<void>;
  getRoles(): Promise<RolesMatrix>;
  saveRoles(matrix: RolesMatrix): Promise<void>;
  listHouses(): Promise<House[]>;
}
