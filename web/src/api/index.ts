import { createHttpAdminApi } from './httpAdminApi';
import { createHttpAuthApi } from './httpAuthApi';
import type { StaffAdminApi, StaffAuthApi } from './types';

let current: StaffAuthApi | undefined;
let currentAdmin: StaffAdminApi | undefined;

export function getApi(): StaffAuthApi {
  current ??= createHttpAuthApi();
  return current;
}

export function getAdminApi(): StaffAdminApi {
  currentAdmin ??= createHttpAdminApi();
  return currentAdmin;
}

/** Подменить клиенты: мок в разработке и тесты. */
export function setApi(api: StaffAuthApi | undefined, admin?: StaffAdminApi): void {
  current = api;
  currentAdmin = admin;
}

export * from './types';
export { currentToken, setTokenProvider } from './token';
