import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, setApi, type StaffAuthApi } from '@/api';
import { createMockAuthApi } from '@/api/mockAuthApi';
import { useSessionStore } from './session';

function api(overrides: Partial<StaffAuthApi>): StaffAuthApi {
  return { ...createMockAuthApi({ latencyMs: 0 }), ...overrides };
}

beforeEach(() => setActivePinia(createPinia()));

describe('сессия', () => {
  it('выход при обрыве сети не закрывает сессию локально', async () => {
    setApi(api({ logout: () => Promise.reject(new ApiError('network')) }));
    const store = useSessionStore();
    await store.login({ email: 'dispatcher@uk.ru', password: 'Password1', remember: true });
    await expect(store.logout()).rejects.toMatchObject({ code: 'network' });
    expect(store.session).not.toBeNull();
  });

  it('успешный выход очищает сессию', async () => {
    setApi(api({}));
    const store = useSessionStore();
    await store.login({ email: 'dispatcher@uk.ru', password: 'Password1', remember: true });
    await store.logout();
    expect(store.session).toBeNull();
  });

  it('сбой сети при восстановлении не закрепляет «не вошёл» — следующий переход пробует снова', async () => {
    const refresh = vi
      .fn<StaffAuthApi['refresh']>()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockResolvedValueOnce({ accessToken: 't', user: { id: '1', name: 'Анна Соколова', role: 'dispatcher' } });
    setApi(api({ refresh }));
    const store = useSessionStore();
    await store.restore();
    expect(store.session).toBeNull();
    expect(store.restored).toBe(false);
    await store.restore();
    expect(store.session?.user.name).toBe('Анна Соколова');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('отсутствие куки закрепляет «не вошёл» без повторов', async () => {
    const refresh = vi.fn<StaffAuthApi['refresh']>().mockRejectedValue(new ApiError('unauthorized'));
    setApi(api({ refresh }));
    const store = useSessionStore();
    await store.restore();
    await store.restore();
    expect(store.restored).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
