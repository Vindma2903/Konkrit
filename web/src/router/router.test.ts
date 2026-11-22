import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { useFlowStore } from '@/stores/flow';
import { useSessionStore } from '@/stores/session';
import { mountApp } from '@/test/helpers';

describe('охранники маршрутов', () => {
  it('без сессии кабинет ведёт на вход с next', async () => {
    const { router } = await mountApp('/');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.next).toBe('/');
  });

  it('вошедший, открыв вход, попадает в кабинет', async () => {
    const { router, pinia } = await mountApp('/register');
    await useSessionStore(pinia).login({ email: 'dispatcher@uk.ru', password: 'Password1', remember: true });
    await router.push('/login');
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('cabinet'));
  });

  it('сессия восстанавливается после перезагрузки при «запомнить меня»', async () => {
    const first = await mountApp('/login');
    await useSessionStore(first.pinia).login({ email: 'dispatcher@uk.ru', password: 'Password1', remember: true });
    first.wrapper.unmount();
    const second = await mountApp('/');
    expect(second.router.currentRoute.value.name).toBe('cabinet');
  });

  it('без «запомнить меня» сессия живёт только в рамках вкладки, а выход её стирает', async () => {
    const first = await mountApp('/login');
    const store = useSessionStore(first.pinia);
    await store.login({ email: 'dispatcher@uk.ru', password: 'Password1', remember: false });
    expect(localStorage.length).toBe(0);
    await store.logout();
    first.wrapper.unmount();
    const second = await mountApp('/');
    expect(second.router.currentRoute.value.name).toBe('login');
  });

  it('сброс сессии на защищённом экране открывает вход', async () => {
    const { router, pinia } = await mountApp('/login');
    const store = useSessionStore(pinia);
    await store.login({ email: 'dispatcher@uk.ru', password: 'Password1', remember: true });
    await router.push('/');
    store.expire();
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.next).toBe('/');
  });

  it('«Письмо отправлено» без запроса ведёт к форме', async () => {
    const { router } = await mountApp('/forgot/sent');
    expect(router.currentRoute.value.name).toBe('forgot');
  });

  it('«Письмо отправлено» открывается, если запрос был', async () => {
    const first = await mountApp('/login');
    useFlowStore(first.pinia).setRecovery({ email: 'a@b.ru', ttlMin: 30, availableAt: Date.now() + 1000 });
    first.wrapper.unmount();
    const { router } = await mountApp('/forgot/sent');
    expect(router.currentRoute.value.name).toBe('forgot-sent');
  });
});
