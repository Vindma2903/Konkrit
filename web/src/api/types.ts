export type StaffRole = 'dispatcher' | 'employee' | 'admin';

export type StaffUser = { id: string; name: string; role: StaffRole };

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
