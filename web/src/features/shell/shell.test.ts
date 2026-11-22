import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type StaffAdminApi } from '@/api';
import { createMockStaff } from '@/api/mockAuthApi';
import { useSessionStore } from '@/stores/session';
import { mountApp, openAs } from '@/test/helpers';

const navTitles = (wrapper: Awaited<ReturnType<typeof mountApp>>['wrapper']) =>
  wrapper.findAll('.shell__nav .nav-link span:not(.count-badge):not(.sr-only)').map((node) => node.text());

describe('каркас CRM: меню по правам', () => {
  it('руководителю видны все разделы', async () => {
    const { wrapper } = await openAs('manager@uk.ru');
    expect(navTitles(wrapper)).toEqual([
      'Заявки',
      'Задачи',
      'Акты',
      'Чаты',
      'Подрядчики',
      'Сотрудники',
      'Аналитика',
      'Справочники',
    ]);
  });

  it('диспетчеру скрыты разделы без права', async () => {
    const { wrapper } = await openAs('dispatcher@uk.ru');
    expect(navTitles(wrapper)).toEqual(['Заявки', 'Задачи', 'Акты', 'Чаты']);
  });

  it('исполнителю — только то, что разрешено матрицей', async () => {
    const { wrapper } = await openAs('executor@uk.ru');
    expect(navTitles(wrapper)).toEqual(['Заявки', 'Задачи', 'Акты', 'Чаты']);
  });

  it('блок пользователя: имя и роль руководителя', async () => {
    const { wrapper } = await openAs('manager@uk.ru');
    expect(wrapper.find('.user-btn__name').text()).toBe('Мария Воронина');
    expect(wrapper.find('.user-btn__role').text()).toBe('Руководитель');
  });

  it('главная — заглушка «Заявки»; разделы без экрана открывают заглушку с названием', async () => {
    const { wrapper, router } = await openAs('manager@uk.ru');
    expect(wrapper.find('h1').text()).toBe('Заявки');
    expect(wrapper.text()).toContain('Раздел появится в следующих версиях');
    await router.push('/section/analytics');
    await vi.waitFor(() => expect(wrapper.find('h1').text()).toBe('Аналитика'));
    expect(wrapper.find('.nav-link--active').text()).toContain('Аналитика');
  });
});

describe('каркас CRM: доступ по праву', () => {
  it('без staff.manage раздел «Сотрудники» показывает «Нет доступа» и не грузит данные', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const listMembers = vi.spyOn(mock.admin, 'listMembers');
    const first = await mountApp('/login', undefined, mock);
    await useSessionStore(first.pinia).login({ email: 'dispatcher@uk.ru', password: 'Password1', remember: true });
    first.wrapper.unmount();
    const { wrapper } = await mountApp('/staff', undefined, mock);
    expect(wrapper.find('[data-testid="no-access"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Нет доступа');
    expect(wrapper.text()).toContain('Вернуться на главную');
    expect(listMembers).not.toHaveBeenCalled();
  });
});

describe('каркас CRM: выход', () => {
  it('«Выйти» закрывает сессию и открывает вход', async () => {
    const { wrapper, router } = await openAs('manager@uk.ru');
    await wrapper.find('.user-btn').trigger('click');
    const logout = wrapper.findAll('[role=menuitem]').find((item) => item.text() === 'Выйти')!;
    await logout.trigger('click');
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'));
    expect(router.currentRoute.value.query.next).toBeUndefined();
  });

  it('при обрыве сети выход не закрывает сессию и показывает ошибку', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    vi.spyOn(mock.auth, 'logout').mockRejectedValue(new ApiError('network'));
    const first = await mountApp('/login', undefined, mock);
    await useSessionStore(first.pinia).login({ email: 'manager@uk.ru', password: 'Password1', remember: true });
    first.wrapper.unmount();
    const { wrapper, router } = await mountApp('/', undefined, mock);
    await wrapper.find('.user-btn').trigger('click');
    await wrapper.find('[role=menuitem]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role=alert]').text()).toBe('Не удалось выйти. Проверьте соединение и повторите');
    expect(router.currentRoute.value.name).toBe('cabinet');
  });
});

describe('каркас CRM: отказы сервера', () => {
  it('forbidden обновляет права: меню и доступ меняются без повторного входа', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const first = await mountApp('/login', undefined, mock);
    const store = useSessionStore(first.pinia);
    await store.login({ email: 'engineer@uk.ru', password: 'Password1', remember: true });
    first.wrapper.unmount();
    // руководитель выдал инженеру право управлять сотрудниками
    const state = mock.state();
    state.matrix.engineer = [...state.matrix.engineer, 'staff.manage'];
    const { wrapper, pinia } = await mountApp('/', undefined, mock);
    // права в сессии прежние, но сервер уже выдал новое право: обновление подтягивает его
    await useSessionStore(pinia).reload();
    await flushPromises();
    expect(navTitles(wrapper)).toContain('Сотрудники');
  });

  it('отключённый сотрудник: reload сбрасывает сессию и открывается вход', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const first = await mountApp('/login', undefined, mock);
    await useSessionStore(first.pinia).login({ email: 'engineer@uk.ru', password: 'Password1', remember: true });
    first.wrapper.unmount();
    const { router, pinia } = await mountApp('/', undefined, mock);
    mock.state().members.find((member) => member.email === 'engineer@uk.ru')!.status = 'disabled';
    await useSessionStore(pinia).reload();
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'));
  });
});

// тип проверяется компилятором: клиент администрирования реализует весь контракт
const _contract: StaffAdminApi = createMockStaff().admin;
void _contract;
