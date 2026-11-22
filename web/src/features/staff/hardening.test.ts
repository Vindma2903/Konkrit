import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, setApi, setTokenProvider } from '@/api';
import { createMockStaff } from '@/api/mockAuthApi';
import { useSessionStore } from '@/stores/session';
import { button, openAs } from '@/test/helpers';
import { adminCall } from './adminCall';

const PASSWORD = 'Password1';

afterEach(() => {
  vi.useRealTimers();
  setTokenProvider(() => null);
});

async function storeWith(email: string, mock = createMockStaff({ latencyMs: 0 })) {
  setActivePinia(createPinia());
  setApi(mock.auth, mock.admin);
  const store = useSessionStore();
  await store.login({ email, password: PASSWORD, remember: true });
  return { store, mock };
}

describe('adminCall: просроченный токен', () => {
  it('401: сессия обновляется по refresh-куке и запрос повторяется один раз', async () => {
    const { store } = await storeWith('manager@uk.ru');
    const oldToken = store.session!.accessToken;
    const request = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError('unauthorized'))
      .mockResolvedValueOnce('ok');
    await expect(adminCall(request)).resolves.toBe('ok');
    expect(request).toHaveBeenCalledTimes(2);
    expect(store.session).not.toBeNull();
    expect(store.session!.accessToken).not.toBe(oldToken);
  });

  it('обновить не удалось (доступ отключён) — сессия сбрасывается, запрос не повторяется', async () => {
    const { store, mock } = await storeWith('engineer@uk.ru');
    mock.state().members.find((m) => m.email === 'engineer@uk.ru')!.status = 'disabled';
    const request = vi.fn<() => Promise<string>>().mockRejectedValue(new ApiError('unauthorized'));
    await expect(adminCall(request)).rejects.toMatchObject({ code: 'unauthorized' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(store.session).toBeNull();
  });

  it('после обновления снова 401 — сессия сбрасывается', async () => {
    const { store } = await storeWith('manager@uk.ru');
    const request = vi.fn<() => Promise<string>>().mockRejectedValue(new ApiError('unauthorized'));
    await expect(adminCall(request)).rejects.toMatchObject({ code: 'unauthorized' });
    expect(request).toHaveBeenCalledTimes(2);
    expect(store.session).toBeNull();
  });

  it('прочие ошибки проходят без обновления сессии', async () => {
    const { store } = await storeWith('manager@uk.ru');
    const token = store.session!.accessToken;
    await expect(adminCall(() => Promise.reject(new ApiError('network')))).rejects.toMatchObject({ code: 'network' });
    expect(store.session!.accessToken).toBe(token);
  });
});

describe('сессия: reload без гонок', () => {
  it('параллельные вызовы делят один запрос', async () => {
    const { store, mock } = await storeWith('manager@uk.ru');
    const refresh = vi.spyOn(mock.auth, 'refresh');
    await Promise.all([store.reload(), store.reload(), store.reload()]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ответ, пришедший после выхода, не возвращает сессию', async () => {
    const { store, mock } = await storeWith('manager@uk.ru');
    let release: () => void = () => undefined;
    const real = mock.auth.refresh.bind(mock.auth);
    vi.spyOn(mock.auth, 'refresh').mockImplementation(async () => {
      const session = await real();
      await new Promise<void>((resolve) => (release = resolve));
      return session;
    });
    const pending = store.reload();
    await flushPromises();
    await store.logout();
    expect(store.session).toBeNull();
    release();
    await pending;
    expect(store.session).toBeNull();
  });
});

describe('мок: хранилище, общее для вкладок', () => {
  beforeEach(() => localStorage.clear());

  it('заявка, созданная в одной вкладке, видна администратору в другой и не затирается его действиями', async () => {
    const admin = createMockStaff({ latencyMs: 0, persist: true });
    const visitor = createMockStaff({ latencyMs: 0, persist: true });
    const session = await admin.auth.login({ email: 'manager@uk.ru', password: PASSWORD, remember: true });
    setTokenProvider(() => session.accessToken);

    await visitor.auth.register({
      name: 'Нина Орлова',
      company: 'УК',
      email: 'nina@uk.ru',
      phone: '+79001234567',
      password: PASSWORD,
      consent: true,
    });
    const page = await admin.admin.listAccessRequests('pending');
    expect(page.items.map((item) => item.email)).toContain('nina@uk.ru');

    // действие администратора не стирает заявку, пришедшую из другой вкладки
    await visitor.auth.register({
      name: 'Олег Рыжов',
      company: 'УК',
      email: 'oleg@uk.ru',
      phone: '+79007654321',
      password: PASSWORD,
      consent: true,
    });
    await admin.admin.rejectAccessRequest('request-1');
    const after = await visitor.admin.listAccessRequests('pending').catch(() => null);
    expect(after).toBeNull(); // у посетителя нет токена: сервер не отдаёт заявки
    const final = await admin.admin.listAccessRequests('pending');
    expect(final.items.map((item) => item.email).sort()).toEqual(['new1@uk.ru', 'nina@uk.ru', 'oleg@uk.ru']);
  });
});

describe('мок как образец сервера: проверки данных и отзыв сессии', () => {
  it('неизвестная роль и статус отклоняются, а не ломают сервер', async () => {
    const { mock } = await storeWith('manager@uk.ru');
    const target = mock.state().members.find((m) => m.email === 'executor@uk.ru')!;
    await expect(mock.admin.updateMember(target.id, { role: 'x' as never })).rejects.toMatchObject({ code: 'validation' });
    await expect(mock.admin.updateMember(target.id, { status: 'x' as never })).rejects.toMatchObject({ code: 'validation' });
    await expect(mock.admin.listMembers()).resolves.toBeInstanceOf(Array);
  });

  it('неполная матрица и неизвестные права отклоняются', async () => {
    const { mock } = await storeWith('manager@uk.ru');
    const matrix = await mock.admin.getRoles();
    await expect(
      mock.admin.saveRoles({ ...matrix, executor: undefined } as never),
    ).rejects.toMatchObject({ code: 'validation' });
    await expect(
      mock.admin.saveRoles({ ...matrix, executor: ['hack'] } as never),
    ).rejects.toMatchObject({ code: 'validation' });
  });

  it('после выхода токен больше не работает', async () => {
    const { store, mock } = await storeWith('manager@uk.ru');
    const token = store.session!.accessToken;
    await store.logout();
    setTokenProvider(() => token);
    await expect(mock.admin.listMembers()).rejects.toMatchObject({ code: 'unauthorized' });
  });
});

describe('экраны: сохранение прав и закрытие панели', () => {
  it('флажки блокируются на время сохранения, сохраняется отправленный снимок', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const app = await openAs('manager@uk.ru', '/staff/roles', mock);
    await vi.waitFor(() => expect(app.wrapper.find('table.matrix').exists()).toBe(true));
    let release: () => void = () => undefined;
    let sent: unknown;
    vi.spyOn(mock.admin, 'saveRoles').mockImplementation((matrix) => {
      sent = matrix;
      return new Promise<void>((resolve) => (release = resolve));
    });
    const box = (permission: string, role: string) =>
      app.wrapper.find(`input[aria-label="${permission}: ${role}"]`);
    await box('Видеть аналитику', 'Диспетчер').setValue(true);
    await button(app.wrapper, 'Сохранить').trigger('click');
    // во время запроса менять матрицу нельзя
    expect((box('Создавать заявки', 'Исполнитель').element as HTMLInputElement).disabled).toBe(true);
    release();
    await flushPromises();
    expect((sent as { dispatcher: string[] }).dispatcher).toContain('analytics.view');
    expect(button(app.wrapper, 'Сохранить').attributes('disabled')).toBeDefined();
    expect((box('Создавать заявки', 'Исполнитель').element as HTMLInputElement).disabled).toBe(false);
  });

  it('пока идёт запрос, панель не закрывается ни Esc, ни крестиком', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const app = await openAs('manager@uk.ru', '/staff/access', mock);
    await vi.waitFor(() => expect(app.wrapper.find('[data-testid="request-request-1"]').exists()).toBe(true));
    await button(app.wrapper.find('[data-testid="request-request-1"]') as never, 'Подтвердить').trigger('click');
    await vi.waitFor(() => expect(app.wrapper.find('[data-testid="can-box"]').exists()).toBe(true));
    let release: () => void = () => undefined;
    vi.spyOn(mock.admin, 'approveAccessRequest').mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    await app.wrapper.findAll('.checklist input')[0]!.setValue(true);
    await button(app.wrapper, 'Подтвердить доступ').trigger('click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(app.wrapper.find('[role=dialog]').exists()).toBe(true);
    expect(app.wrapper.find('button[aria-label="Закрыть"][data-close]').attributes('disabled')).toBeDefined();
    release();
    await vi.waitFor(() => expect(app.wrapper.find('[role=dialog]').exists()).toBe(false));
  });

  it('отмена диалога отклонения очищает ошибку, чужая ошибка не остаётся в панели', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const app = await openAs('manager@uk.ru', '/staff/access', mock);
    await vi.waitFor(() => expect(app.wrapper.find('[data-testid="request-request-1"]').exists()).toBe(true));
    await button(app.wrapper.find('[data-testid="request-request-1"]') as never, 'Подтвердить').trigger('click');
    await vi.waitFor(() => expect(app.wrapper.find('[data-testid="can-box"]').exists()).toBe(true));
    vi.spyOn(mock.admin, 'rejectAccessRequest').mockRejectedValue(new ApiError('network'));
    await button(app.wrapper.find('.panel') as never, 'Отклонить').trigger('click');
    await button(app.wrapper.find('[role=alertdialog]') as never, 'Отклонить').trigger('click');
    await flushPromises();
    expect(app.wrapper.find('[role=alertdialog] .alert').exists()).toBe(true);
    await button(app.wrapper.find('[role=alertdialog]') as never, 'Отмена').trigger('click');
    expect(app.wrapper.find('[role=alertdialog]').exists()).toBe(false);
    expect(app.wrapper.find('.panel .alert').exists()).toBe(false);
  });

  it('возврат на вкладку браузера обновляет список заявок', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const app = await openAs('manager@uk.ru', '/staff/access', mock);
    await vi.waitFor(() => expect(app.wrapper.findAll('tbody tr')).toHaveLength(2));
    await mock.auth.register({
      name: 'Нина Орлова',
      company: 'УК',
      email: 'nina@uk.ru',
      phone: '+79001234567',
      password: PASSWORD,
      consent: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(app.wrapper.findAll('tbody tr')).toHaveLength(3));
  });
});

describe('экраны: отказ сервера по праву', () => {
  it('forbidden на запросе раздела: права обновляются, раздел показывает «Нет доступа»', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    // диспетчеру временно выдали право управлять сотрудниками
    mock.state().matrix.dispatcher = [...mock.state().matrix.dispatcher, 'staff.manage'];
    const app = await openAs('dispatcher@uk.ru', '/staff', mock);
    await vi.waitFor(() => expect(app.wrapper.findAll('tbody tr').length).toBeGreaterThan(0));
    // право сняли на сервере, а в сессии оно ещё есть
    mock.state().matrix.dispatcher = mock.state().matrix.dispatcher.filter((p) => p !== 'staff.manage');
    await app.wrapper.find('select[aria-label="Роль"]').setValue('executor');
    await vi.waitFor(() => expect(app.wrapper.find('[data-testid="no-access"]').exists()).toBe(true));
    expect(app.wrapper.text()).not.toContain('Сотрудники не найдены');
  });
});

describe('каркас: меню пользователя с клавиатуры', () => {
  it('открывается на пункте «Выйти», Esc закрывает и возвращает фокус', async () => {
    const app = await openAs('manager@uk.ru');
    const toggle = app.wrapper.find('.user-btn');
    await toggle.trigger('click');
    await flushPromises();
    expect(document.activeElement?.textContent?.trim()).toBe('Выйти');
    await app.wrapper.find('.shell__user').trigger('keydown', { key: 'Escape' });
    expect(app.wrapper.find('[role=menu]').exists()).toBe(false);
    expect(document.activeElement).toBe(toggle.element);
  });
});
