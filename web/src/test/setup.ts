import { afterEach } from 'vitest';

afterEach(() => {
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    // хранилище недоступно — тестам оно не нужно
  }
});
