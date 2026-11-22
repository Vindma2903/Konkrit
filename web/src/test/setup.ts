import { afterEach } from 'vitest';
import { unmountAll } from './helpers';

afterEach(() => {
  unmountAll();
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    // хранилище недоступно — тестам оно не нужно
  }
});
