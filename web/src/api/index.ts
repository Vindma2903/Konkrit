import { createHttpAuthApi } from './httpAuthApi';
import type { StaffAuthApi } from './types';

let current: StaffAuthApi | undefined;

export function getApi(): StaffAuthApi {
  current ??= createHttpAuthApi();
  return current;
}

/** Подменить клиент: мок в разработке и тесты. */
export function setApi(api: StaffAuthApi | undefined): void {
  current = api;
}

export * from './types';
