import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api';
import { createMockStaff } from '@/api/mockAuthApi';
import { button, openAs } from '@/test/helpers';

afterEach(() => {
  vi.useRealTimers();
});

type App = Awaited<ReturnType<typeof openAs>>;

const rows = (app: App) => app.wrapper.findAll('tbody tr');
const rowOf = (app: App, email: string) => {
  const member = app.mock.state().members.find((item) => item.email === email)!;
  return app.wrapper.find(`[data-testid="member-${member.id}"]`);
};

async function listApp(email = 'manager@uk.ru') {
  const app = await openAs(email, '/staff');
  await vi.waitFor(() => expect(rows(app).length).toBeGreaterThan(0));
  return app;
}

async function openMenu(app: App, email: string) {
  await rowOf(app, email).find('button[aria-haspopup=menu]').trigger('click');
  await flushPromises();
}

const menuItems = (app: App) => app.wrapper.findAll('[role=menuitem]').map((item) => item.text());

describe('сотрудники: таблица', () => {
  it('столбцы, роли, область работы и статусы по макету', async () => {
    const app = await listApp();
    const headers = app.wrapper.findAll('thead th').map((th) => th.text());
    expect(headers.slice(0, 4)).toEqual(['Сотрудник', 'Роль', 'Дом / участок', 'Статус']);
    expect(rows(app)).toHaveLength(6);
    const manager = rowOf(app, 'manager@uk.ru').text();
    expect(manager).toContain('Мария Воронина');
    expect(manager).toContain('+7 900 111-22-33');
    expect(manager).toContain('Руководитель');
    expect(manager).toContain('Все дома');
    expect(manager).toContain('Активен');
    const engineer = rowOf(app, 'engineer@uk.ru').text();
    expect(engineer).toContain('Инженер/куратор');
    expect(engineer).toContain('ул. Тестовая, д. 1, ул. Образцовая, д. 12');
    expect(rowOf(app, 'executor2@uk.ru').text()).toContain('В отпуске');
    expect(rowOf(app, 'blocked@uk.ru').text()).toContain('Отключён');
    expect(app.wrapper.text()).toContain('Заявки на доступ');
  });

  it('у кнопки действий имя содержит сотрудника', async () => {
    const app = await listApp();
    expect(rowOf(app, 'engineer@uk.ru').find('button[aria-haspopup=menu]').attributes('aria-label')).toBe(
      'Действия с сотрудником Павел Громов',
    );
  });

  it('ошибка загрузки: сообщение и «Повторить»', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const real = mock.admin.listMembers;
    let fail = true;
    mock.admin.listMembers = (filters) => (fail ? Promise.reject(new ApiError('network')) : real(filters));
    const app = await openAs('manager@uk.ru', '/staff', mock);
    await vi.waitFor(() => expect(app.wrapper.text()).toContain('Не удалось загрузить сотрудников'));
    fail = false;
    await button(app.wrapper, 'Повторить').trigger('click');
    await vi.waitFor(() => expect(rows(app)).toHaveLength(6));
  });
});

describe('сотрудники: поиск и фильтры', () => {
  it('поиск срабатывает через 300 мс после последнего символа', async () => {
    const app = await listApp();
    const spy = vi.spyOn(app.mock.admin, 'listMembers');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const input = app.wrapper.find('input[type=search]');
    await input.setValue('п');
    await input.setValue('па');
    await input.setValue('павел');
    await vi.advanceTimersByTimeAsync(299);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    await flushPromises();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toMatchObject({ query: 'павел' });
    expect(rows(app)).toHaveLength(1);
    expect(rows(app)[0]!.text()).toContain('Павел Громов');
  });

  it('медленный ответ на прежний текст не перезаписывает новый', async () => {
    const app = await listApp();
    const real = app.mock.admin.listMembers;
    let releaseSlow: () => void = () => undefined;
    vi.spyOn(app.mock.admin, 'listMembers').mockImplementation(async (filters) => {
      const result = await real(filters);
      if (filters?.query === 'сергей') await new Promise<void>((resolve) => (releaseSlow = resolve));
      return result;
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const input = app.wrapper.find('input[type=search]');
    await input.setValue('сергей');
    await vi.advanceTimersByTimeAsync(310);
    await input.setValue('павел');
    await vi.advanceTimersByTimeAsync(310);
    await flushPromises();
    releaseSlow();
    await flushPromises();
    expect(rows(app)).toHaveLength(1);
    expect(rows(app)[0]!.text()).toContain('Павел Громов');
  });

  it('роль, дом и статус сужают список вместе', async () => {
    const app = await listApp();
    await app.wrapper.find('select[aria-label="Роль"]').setValue('executor');
    await vi.waitFor(() => expect(rows(app)).toHaveLength(2));
    await app.wrapper.find('select[aria-label="Статус"]').setValue('vacation');
    await vi.waitFor(() => expect(rows(app)).toHaveLength(1));
    expect(rows(app)[0]!.text()).toContain('Ольга Кузнецова');
    await app.wrapper.find('select[aria-label="Роль"]').setValue('');
    await app.wrapper.find('select[aria-label="Статус"]').setValue('');
    await app.wrapper.find('select[aria-label="Дом / участок"]').setValue('area-1');
    // «все дома» у руководителя, диспетчера и отключённого плюс двое исполнителей участка
    await vi.waitFor(() => expect(rows(app).length).toBe(5));
  });

  it('ничего не найдено: сообщение и «Сбросить фильтры»', async () => {
    const app = await listApp();
    await app.wrapper.find('select[aria-label="Роль"]').setValue('manager');
    await app.wrapper.find('select[aria-label="Статус"]').setValue('vacation');
    await vi.waitFor(() => expect(app.wrapper.find('[data-testid="staff-empty"]').exists()).toBe(true));
    expect(app.wrapper.text()).toContain('Сотрудники не найдены');
    await button(app.wrapper, 'Сбросить фильтры').trigger('click');
    await vi.waitFor(() => expect(rows(app)).toHaveLength(6));
    expect((app.wrapper.find('select[aria-label="Роль"]').element as HTMLSelectElement).value).toBe('');
  });
});

describe('сотрудники: меню действий', () => {
  it('пункты зависят от статуса; у себя «Отключить доступ» нет', async () => {
    const app = await listApp();
    const closeMenu = () => app.wrapper.find('[role=menu]').trigger('keydown', { key: 'Escape' });
    await openMenu(app, 'engineer@uk.ru');
    expect(menuItems(app)).toEqual(['Изменить роль и дома', 'В отпуске', 'Отключить доступ']);
    await closeMenu();
    await openMenu(app, 'executor2@uk.ru');
    expect(menuItems(app)).toEqual(['Изменить роль и дома', 'Вернуть из отпуска', 'Отключить доступ']);
    await closeMenu();
    await openMenu(app, 'blocked@uk.ru');
    expect(menuItems(app)).toEqual(['Изменить роль и дома', 'Включить доступ']);
    await closeMenu();
    await openMenu(app, 'manager@uk.ru');
    expect(menuItems(app)).toEqual(['Изменить роль и дома', 'В отпуске']);
  });

  it('с клавиатуры: меню открывается на первом пункте, стрелки переключают, Esc закрывает и возвращает фокус', async () => {
    const app = await listApp();
    const toggle = rowOf(app, 'engineer@uk.ru').find('button[aria-haspopup=menu]');
    await toggle.trigger('click');
    await flushPromises();
    const items = app.wrapper.findAll('[role=menuitem]');
    expect(document.activeElement).toBe(items[0]!.element);
    await app.wrapper.find('[role=menu]').trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]!.element);
    await app.wrapper.find('[role=menu]').trigger('keydown', { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]!.element);
    await app.wrapper.find('[role=menu]').trigger('keydown', { key: 'Escape' });
    expect(app.wrapper.find('[role=menu]').exists()).toBe(false);
    expect(document.activeElement).toBe(toggle.element);
  });

  it('«Изменить роль и дома»: панель с «Сохранить», изменения видны в списке сразу', async () => {
    const app = await listApp();
    await openMenu(app, 'executor@uk.ru');
    await button(app.wrapper, 'Изменить роль и дома').trigger('click');
    await vi.waitFor(() => expect(app.wrapper.find('[data-testid="can-box"]').exists()).toBe(true));
    const panel = app.wrapper.find('[role=dialog]');
    expect(panel.text()).toContain('Сергей Петров');
    expect(panel.text()).not.toContain('Отправить сотруднику письмо');
    expect(panel.text()).not.toContain('Отклонить');
    expect((panel.find('select').element as HTMLSelectElement).value).toBe('executor');
    await panel.find('select').setValue('engineer');
    await app.wrapper.findAll('.checklist input')[1]!.setValue(true); // дом 1
    await button(panel as never, 'Сохранить').trigger('click');
    await vi.waitFor(() => expect(app.wrapper.find('[role=dialog]').exists()).toBe(false));
    const text = rowOf(app, 'executor@uk.ru').text();
    expect(text).toContain('Инженер/куратор');
    expect(text).toContain('ул. Тестовая, д. 1');
    expect(app.wrapper.find('.toast').text()).toBe('Изменения сохранены');
  });

  it('отключение с подтверждением: «Отключён», сессия и вход закрыты', async () => {
    const app = await listApp();
    await openMenu(app, 'engineer@uk.ru');
    await button(app.wrapper, 'Отключить доступ').trigger('click');
    const dialog = app.wrapper.find('[role=alertdialog]');
    expect(dialog.text()).toContain('Отключить доступ для Павел Громов?');
    expect(dialog.text()).toContain('Сотрудник не сможет войти');
    await button(dialog as never, 'Отключить доступ').trigger('click');
    await vi.waitFor(() => expect(app.wrapper.find('[role=alertdialog]').exists()).toBe(false));
    expect(rowOf(app, 'engineer@uk.ru').text()).toContain('Отключён');
    await expect(
      app.mock.auth.login({ email: 'engineer@uk.ru', password: 'Password1', remember: false }),
    ).rejects.toMatchObject({ code: 'blocked' });
  });

  it('«В отпуске» и «Вернуть из отпуска»', async () => {
    const app = await listApp();
    await openMenu(app, 'engineer@uk.ru');
    await button(app.wrapper, 'В отпуске').trigger('click');
    await vi.waitFor(() => expect(rowOf(app, 'engineer@uk.ru').text()).toContain('В отпуске'));
    await openMenu(app, 'engineer@uk.ru');
    await button(app.wrapper, 'Вернуть из отпуска').trigger('click');
    await vi.waitFor(() => expect(rowOf(app, 'engineer@uk.ru').text()).toContain('Активен'));
  });

  it('«Включить доступ» возвращает отключённого', async () => {
    const app = await listApp();
    await openMenu(app, 'blocked@uk.ru');
    await button(app.wrapper, 'Включить доступ').trigger('click');
    await vi.waitFor(() => expect(rowOf(app, 'blocked@uk.ru').text()).toContain('Активен'));
  });

  it('последний руководитель: отказ сервера показывается в диалоге', async () => {
    const app = await listApp();
    vi.spyOn(app.mock.admin, 'updateMember').mockRejectedValue(new ApiError('last_manager'));
    await openMenu(app, 'dispatcher@uk.ru');
    await button(app.wrapper, 'Отключить доступ').trigger('click');
    await button(app.wrapper.find('[role=alertdialog]') as never, 'Отключить доступ').trigger('click');
    await flushPromises();
    expect(app.wrapper.find('[role=alertdialog] .alert').text()).toBe('Нельзя отключить последнего руководителя');
    expect(rowOf(app, 'dispatcher@uk.ru').text()).toContain('Активен');
  });
});
