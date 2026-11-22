import Constants from 'expo-constants';

import type { ApiClient } from './types';

export * from './types';

let current: ApiClient | null = null;

/** Подменить клиента (тесты, подключение реального клиента). */
export function setApi(client: ApiClient | null) {
  current = client;
}

/**
 * Единственная точка получения клиента: экраны не обращаются к данным напрямую.
 * Мок включается только в режиме разработки при флаге `extra.useMockApi`.
 */
export function getApi(): ApiClient {
  if (current) return current;
  if (__DEV__ && Constants.expoConfig?.extra?.useMockApi === true) {
    // require внутри __DEV__: в релизной сборке Metro убирает эту ветку целиком,
    // и мок с тестовыми токенами и кодом не попадает в бандл.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMockApi } = require('./mockApi') as typeof import('./mockApi');
    current = createMockApi();
    return current;
  }
  throw new Error(
    'ApiClient не настроен: реальный клиент пока не подключён, мок доступен только в режиме разработки.',
  );
}
