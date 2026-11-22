import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api';
import { createMockStaff } from '@/api/mockAuthApi';
import { button, openAs } from '@/test/helpers';

type App = Awaited<ReturnType<typeof openAs>>;

async function rolesApp(mock = createMockStaff({ latencyMs: 0 })) {
  const app = await openAs('manager@uk.ru', '/staff/roles', mock);
  await vi.waitFor(() => expect(app.wrapper.find('table.matrix').exists()).toBe(true));
  return app;
}

const box = (app: App, permission: string, role: string) =>
  app.wrapper.find(`input[aria-label="${permission}: ${role}"]`);
const checked = (app: App, permission: string, role: string) =>
  (box(app, permission, role).element as HTMLInputElement).checked;

describe('роли и права: матрица', () => {
  it('заголовок, пояснение, девять функций и четыре роли', async () => {
    const app = await rolesApp();
    expect(app.wrapper.find('h1').text()).toBe('Роли и права');
    expect(app.wrapper.text()).toContain(
      'Отметьте функции, доступные каждой роли. Изменения применяются ко всем сотрудникам с этой ролью.',
    );
    expect(app.wrapper.findAll('thead th').map((th) => th.text())).toEqual([
      'Функция',
      'Диспетчер',
      'Инженер/куратор',
      'Исполнитель',
      'Руководитель',
    ]);
    expect(app.wrapper.findAll('tbody tr')).toHaveLength(9);
  });

  it('значения как на макете', async () => {
    const app = await rolesApp();
    expect(checked(app, 'Создавать заявки', 'Диспетчер')).toBe(true);
    expect(checked(app, 'Создавать заявки', 'Исполнитель')).toBe(false);
    expect(checked(app, 'Менять статус заявки', 'Исполнитель')).toBe(true);
    expect(checked(app, 'Видеть аналитику', 'Диспетчер')).toBe(false);
    expect(checked(app, 'Видеть аналитику', 'Инженер/куратор')).toBe(true);
    expect(checked(app, 'Управлять подрядчиками', 'Инженер/куратор')).toBe(true);
    expect(checked(app, 'Редактировать шаблоны актов', 'Руководитель')).toBe(true);
    expect(checked(app, 'Редактировать шаблоны актов', 'Инженер/куратор')).toBe(false);
  });

  it('«Руководитель × Управлять сотрудниками»: отмечен и недоступен, есть пояснение', async () => {
    const app = await rolesApp();
    const cell = box(app, 'Управлять сотрудниками', 'Руководитель');
    expect((cell.element as HTMLInputElement).disabled).toBe(true);
    expect(checked(app, 'Управлять сотрудниками', 'Руководитель')).toBe(true);
    expect(cell.attributes('aria-describedby')).toBe('locked-hint');
    expect(app.wrapper.find('#locked-hint').text()).toContain('Нужен, чтобы управлять доступом');
  });

  it('ошибка загрузки: сообщение и «Повторить»', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const real = mock.admin.getRoles;
    let fail = true;
    mock.admin.getRoles = () => (fail ? Promise.reject(new ApiError('network')) : real());
    const app = await openAs('manager@uk.ru', '/staff/roles', mock);
    await vi.waitFor(() => expect(app.wrapper.text()).toContain('Не удалось загрузить права'));
    fail = false;
    await button(app.wrapper, 'Повторить').trigger('click');
    await vi.waitFor(() => expect(app.wrapper.find('table.matrix').exists()).toBe(true));
  });
});

describe('роли и права: сохранение', () => {
  it('«Сохранить» и «Отмена» доступны, только если матрица изменена; «Отмена» сбрасывает', async () => {
    const app = await rolesApp();
    const save = button(app.wrapper, 'Сохранить');
    const cancel = button(app.wrapper, 'Отмена');
    expect(save.attributes('disabled')).toBeDefined();
    expect(cancel.attributes('disabled')).toBeDefined();
    await box(app, 'Видеть аналитику', 'Диспетчер').setValue(true);
    expect(save.attributes('disabled')).toBeUndefined();
    expect(cancel.attributes('disabled')).toBeUndefined();
    await cancel.trigger('click');
    expect(checked(app, 'Видеть аналитику', 'Диспетчер')).toBe(false);
    expect(save.attributes('disabled')).toBeDefined();
  });

  it('вернули значение обратно — изменений нет', async () => {
    const app = await rolesApp();
    await box(app, 'Видеть аналитику', 'Диспетчер').setValue(true);
    await box(app, 'Видеть аналитику', 'Диспетчер').setValue(false);
    expect(button(app.wrapper, 'Сохранить').attributes('disabled')).toBeDefined();
  });

  it('сохранение: сообщение, новые права действуют у роли', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const app = await rolesApp(mock);
    await box(app, 'Видеть аналитику', 'Диспетчер').setValue(true);
    await box(app, 'Создавать заявки', 'Исполнитель').setValue(true);
    await button(app.wrapper, 'Сохранить').trigger('click');
    await vi.waitFor(() => expect(app.wrapper.find('.toast').text()).toBe('Права сохранены'));
    expect(button(app.wrapper, 'Сохранить').attributes('disabled')).toBeDefined();
    const session = await mock.auth.login({ email: 'dispatcher@uk.ru', password: 'Password1', remember: false });
    expect(session.user.permissions).toContain('analytics.view');
    expect(mock.state().matrix.executor).toContain('requests.create');
  });

  it('двойное нажатие — один запрос', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const app = await rolesApp(mock);
    let release: () => void = () => undefined;
    const save = vi.spyOn(mock.admin, 'saveRoles').mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    await box(app, 'Видеть аналитику', 'Диспетчер').setValue(true);
    const button1 = button(app.wrapper, 'Сохранить');
    await button1.trigger('click');
    await button1.trigger('click');
    expect(save).toHaveBeenCalledTimes(1);
    release();
    await flushPromises();
  });

  it('ошибка: «Не удалось сохранить права. Повторите», отмеченное остаётся', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const app = await rolesApp(mock);
    vi.spyOn(mock.admin, 'saveRoles').mockRejectedValue(new ApiError('unknown'));
    await box(app, 'Видеть аналитику', 'Диспетчер').setValue(true);
    await button(app.wrapper, 'Сохранить').trigger('click');
    await flushPromises();
    expect(app.wrapper.find('[role=alert]').text()).toBe('Не удалось сохранить права. Повторите');
    expect(checked(app, 'Видеть аналитику', 'Диспетчер')).toBe(true);
  });

  it('нет сети — отдельное сообщение', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const app = await rolesApp(mock);
    vi.spyOn(mock.admin, 'saveRoles').mockRejectedValue(new ApiError('network'));
    await box(app, 'Видеть аналитику', 'Диспетчер').setValue(true);
    await button(app.wrapper, 'Сохранить').trigger('click');
    await flushPromises();
    expect(app.wrapper.find('[role=alert]').text()).toContain('Нет соединения');
  });
});

describe('роли и права: уход с несохранёнными изменениями', () => {
  it('«Остаться» оставляет экран, «Выйти» уходит', async () => {
    const app = await rolesApp();
    await box(app, 'Видеть аналитику', 'Диспетчер').setValue(true);
    const navigation = app.router.push('/staff');
    await vi.waitFor(() => expect(app.wrapper.find('[role=alertdialog]').exists()).toBe(true));
    expect(app.wrapper.find('[role=alertdialog]').text()).toContain('Выйти без сохранения?');
    await button(app.wrapper.find('[role=alertdialog]') as never, 'Остаться').trigger('click');
    await navigation;
    expect(app.router.currentRoute.value.name).toBe('staff-roles');
    expect(checked(app, 'Видеть аналитику', 'Диспетчер')).toBe(true);

    const second = app.router.push('/staff');
    await vi.waitFor(() => expect(app.wrapper.find('[role=alertdialog]').exists()).toBe(true));
    await button(app.wrapper.find('[role=alertdialog]') as never, 'Выйти').trigger('click');
    await second;
    expect(app.router.currentRoute.value.name).toBe('staff');
  });

  it('без изменений уходит сразу', async () => {
    const app = await rolesApp();
    await app.router.push('/staff');
    expect(app.router.currentRoute.value.name).toBe('staff');
    expect(app.wrapper.find('[role=alertdialog]').exists()).toBe(false);
  });
});
