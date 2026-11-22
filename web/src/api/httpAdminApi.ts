import { currentToken } from './token';
import { ApiError, type ApiErrorCode, type StaffAdminApi } from './types';

const KNOWN: ApiErrorCode[] = [
  'validation',
  'unauthorized',
  'forbidden',
  'not_found',
  'already_processed',
  'last_manager',
];

const TIMEOUT_MS = 15_000;

type ErrorBody = { code?: string; message?: string; fields?: Record<string, string> };

/** Клиент администрирования к бэкенду: Bearer-токен из сессии, тот же формат ошибок. */
export function createHttpAdminApi(baseUrl: string = import.meta.env.VITE_API_URL ?? '/v1'): StaffAdminApi {
  async function call<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | undefined>,
    signal?: AbortSignal,
  ): Promise<T> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) if (value) params.set(key, value);
    const url = `${baseUrl}/staff${path}${params.size ? `?${params}` : ''}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    signal?.addEventListener('abort', () => controller.abort());
    let response: Response;
    try {
      const token = currentToken();
      response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError('network');
    } finally {
      clearTimeout(timer);
    }
    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    }
    let data: ErrorBody = {};
    try {
      data = (await response.json()) as ErrorBody;
    } catch {
      // тело не JSON
    }
    const code =
      KNOWN.find((item) => item === data.code) ??
      (response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : 'unknown');
    throw new ApiError(code, { message: data.message, fields: data.fields });
  }

  return {
    listAccessRequests: (status) => call('GET', '/access-requests', undefined, { status }),
    approveAccessRequest: (id, input) => call('POST', `/access-requests/${encodeURIComponent(id)}/approve`, input),
    rejectAccessRequest: (id) => call('POST', `/access-requests/${encodeURIComponent(id)}/reject`),
    listMembers: ({ query, role, houseId, status, signal } = {}) =>
      call('GET', '/members', undefined, { query, role, houseId, status }, signal),
    updateMember: (id, patch) => call('PATCH', `/members/${encodeURIComponent(id)}`, patch),
    getRoles: () => call('GET', '/roles'),
    saveRoles: (matrix) => call('PUT', '/roles', { matrix }),
    listHouses: () => call('GET', '/houses'),
  };
}
