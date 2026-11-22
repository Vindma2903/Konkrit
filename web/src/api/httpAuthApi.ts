import { ApiError, type ApiErrorCode, type StaffAuthApi } from './types';

const KNOWN: ApiErrorCode[] = [
  'invalid_credentials',
  'pending_approval',
  'rejected',
  'blocked',
  'rate_limited',
  'email_taken',
  'validation',
  'invalid_token',
  'unauthorized',
];

type ErrorBody = {
  code?: string;
  message?: string;
  retryAfterSec?: number;
  fields?: Record<string, string>;
};

/** Клиент к бэкенду. Refresh-токен живёт в HttpOnly-куке, поэтому запросы идут с credentials. */
export function createHttpAuthApi(baseUrl: string = import.meta.env.VITE_API_URL ?? '/v1'): StaffAuthApi {
  async function call<T>(path: string, body?: unknown, accessToken?: string | null): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/staff/auth${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('network');
    }
    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    }
    let data: ErrorBody = {};
    try {
      data = (await response.json()) as ErrorBody;
    } catch {
      // тело не JSON — оставляем пустым
    }
    const code =
      KNOWN.find((item) => item === data.code) ?? (response.status === 401 ? 'unauthorized' : 'unknown');
    throw new ApiError(code, {
      message: data.message,
      retryAfterSec: data.retryAfterSec,
      fields: data.fields,
    });
  }

  return {
    login: (input) => call('/login', input),
    register: (input) => call('/register', input),
    refresh: () => call('/refresh'),
    logout: (accessToken) => call('/logout', undefined, accessToken),
    forgotPassword: (input) => call('/password/forgot', input),
    resetPassword: (input) => call('/password/reset', input),
  };
}
