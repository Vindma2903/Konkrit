import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api';
import { createMockStaff } from '@/api/mockAuthApi';
import { button, openAs } from '@/test/helpers';

afterEach(() => {
  vi.useRealTimers();
});

const rowFor = (wrapper: Awaited<ReturnType<typeof openAs>>['wrapper'], id: string) =>
  wrapper.find(`[data-testid="request-${id}"]`);

async function panelOpen(email = 'manager@uk.ru', path = '/staff/access', id = 'request-1') {
  const app = await openAs(email, path);
  await vi.waitFor(() => expect(rowFor(app.wrapper, id).exists()).toBe(true));
  await button(rowFor(app.wrapper, id) as never, 'Подтвердить').trigger('click');
  await vi.waitFor(() => expect(app.wrapper.find('[data-testid="can-box"]').exists()).toBe(true));
  return app;
}

describe('заявки на доступ: список', () => {
  it('ожидающие заявки, плашка, статус «Ожидает», счётчик в меню и во вкладке совпадают', async () => {
    const { wrapper } = await openAs('manager@uk.ru', '/staff/access');
    await vi.waitFor(() => expect(wrapper.findAll('tbody tr')).toHaveLength(2));
    expect(wrapper.text()).toContain('Эти сотрудники зарегистрировались и ждут подтверждения');
    expect(wrapper.text()).toContain('Иван Новиков');
    expect(wrapper.text()).toContain('pending@uk.ru');
    expect(wrapper.text()).toContain('Ожидает');
    const badges = wrapper.findAll('.count-badge').map((node) => node.text());
    expect(badges).toEqual(['2', '2']);
    expect(wrapper.find('.tab--active').text()).toContain('Заявки на доступ');
  });

  it('вкладка «Отклонённые»: статус «Отклонена», плашки нет, «Отклонить» скрыта', async () => {
    const { wrapper } = await openAs('manager@uk.ru', '/staff/access?status=rejected');
    await vi.waitFor(() => expect(wrapper.findAll('tbody tr')).toHaveLength(1));
    expect(wrapper.text()).toContain('Роман Крылов');
    expect(wrapper.text()).toContain('Отклонена');
    expect(wrapper.text()).not.toContain('ждут подтверждения');
    const row = rowFor(wrapper, 'request-3');
    expect(row.findAll('button').map((b) => b.text())).toEqual(['Подтвердить']);
  });

  it('нет заявок: «Новых заявок нет», числа во вкладке нет', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    mock.state().requests = [];
    const { wrapper } = await openAs('manager@uk.ru', '/staff/access', mock);
    await vi.waitFor(() => expect(wrapper.find('[data-testid="access-empty"]').text()).toBe('Новых заявок нет'));
    expect(wrapper.find('.tab .count-badge').exists()).toBe(false);
  });

  it('ошибка загрузки: сообщение и «Повторить»', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const real = mock.admin.listAccessRequests;
    let fail = true;
    mock.admin.listAccessRequests = (status) => (fail ? Promise.reject(new ApiError('network')) : real(status));
    const { wrapper } = await openAs('manager@uk.ru', '/staff/access', mock);
    await vi.waitFor(() => expect(wrapper.text()).toContain('Не удалось загрузить заявки'));
    fail = false;
    await button(wrapper, 'Повторить').trigger('click');
    await vi.waitFor(() => expect(wrapper.findAll('tbody tr')).toHaveLength(2));
  });

  it('новая заявка появляется без перезагрузки не позже чем через 30 секунд', async () => {
    const mock = createMockStaff({ latencyMs: 0 });
    const { wrapper } = await openAs('manager@uk.ru', '/staff/access', mock);
    await vi.waitFor(() => expect(wrapper.findAll('tbody tr')).toHaveLength(2));
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    // повторная подписка на таймеры: монтируем экран заново уже под поддельными часами
    wrapper.unmount();
    const again = await openAs('manager@uk.ru', '/staff/access', mock);
    await vi.waitFor(() => expect(again.wrapper.findAll('tbody tr')).toHaveLength(2));
    await mock.auth.register({
      name: 'Нина Орлова',
      company: 'УК',
      email: 'nina@uk.ru',
      phone: '+79001234567',
      password: 'Password1',
      consent: true,
    });
    expect(again.wrapper.findAll('tbody tr')).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(30_000);
    await flushPromises();
    expect(again.wrapper.findAll('tbody tr')).toHaveLength(3);
    expect(again.wrapper.text()).toContain('Нина Орлова');
    expect(again.wrapper.findAll('.count-badge').map((node) => node.text())).toEqual(['3', '3']);
  });
});

describe('заявки на доступ: панель подтверждения', () => {
  it('содержимое панели по макету', async () => {
    const { wrapper } = await panelOpen();
    const panel = wrapper.find('[role=dialog]');
    expect(panel.attributes('aria-modal')).toBe('true');
    expect(panel.text()).toContain('Подтверждение доступа');
    expect(panel.text()).toContain('Заявка на доступ от');
    expect(panel.text()).toContain('Иван Новиков');
    expect(panel.text()).toContain('pending@uk.ru · +7 900 777-88-99');
    expect(panel.text()).toContain('УК «Тест-Сервис»');
    expect(panel.text()).toContain('Все дома и участки');
    expect(panel.text()).toContain('Отправить сотруднику письмо, что доступ открыт');
    expect((panel.find('select').element as HTMLSelectElement).value).toBe('engineer');
    expect((panel.findAll('input[type=checkbox]').at(-1)!.element as HTMLInputElement).checked).toBe(true);
    expect(button(panel as never, 'Подтвердить доступ').exists()).toBe(true);
    expect(button(panel as never, 'Отклонить').exists()).toBe(true);
  });

  it('первый фокус на «Закрыть»', async () => {
    const { wrapper } = await panelOpen();
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('Закрыть');
    expect(wrapper.find('[role=dialog]').exists()).toBe(true);
  });

  it('права выбранной роли показываются сразу', async () => {
    const { wrapper } = await panelOpen();
    const box = () => wrapper.find('[data-testid="can-box"]').text();
    expect(box()).toContain('Видеть аналитику');
    await wrapper.find('select').setValue('executor');
    expect(box()).toContain('Менять статус заявки');
    expect(box()).not.toContain('Видеть аналитику');
    await wrapper.find('select').setValue('manager');
    expect(box()).toContain('Управлять сотрудниками');
  });

  it('«Все дома»: дома отмечены и недоступны, при снятии выбор возвращается', async () => {
    const { wrapper } = await panelOpen();
    const boxes = () => wrapper.findAll('.checklist input').map((node) => node.element as HTMLInputElement);
    await wrapper.findAll('.checklist input')[1]!.setValue(true); // дом 1
    await wrapper.findAll('.checklist input')[0]!.setValue(true); // все
    expect(boxes().slice(1).every((box) => box.checked && box.disabled)).toBe(true);
    await wrapper.findAll('.checklist input')[0]!.setValue(false);
    expect(boxes().map((box) => box.checked)).toEqual([false, true, false, false, false]);
    expect(boxes().every((box) => !box.disabled)).toBe(true);
  });

  it('без домов подтвердить нельзя: ошибка, запрос не уходит, фокус на списке', async () => {
    const { wrapper, mock } = await panelOpen();
    const approve = vi.spyOn(mock.admin, 'approveAccessRequest');
    await button(wrapper, 'Подтвердить доступ').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role=dialog]').text()).toContain('Выберите хотя бы один дом или участок');
    expect(approve).not.toHaveBeenCalled();
    expect(document.activeElement?.closest('.checklist')).not.toBeNull();
  });

  it('подтверждение: заявка уходит, сотрудник «Активен», панель закрыта, сообщение, письмо отправлено', async () => {
    const { wrapper, mock } = await panelOpen();
    await wrapper.find('select').setValue('dispatcher');
    await wrapper.findAll('.checklist input')[0]!.setValue(true);
    await button(wrapper, 'Подтвердить доступ').trigger('click');
    await vi.waitFor(() => expect(wrapper.find('[role=dialog]').exists()).toBe(false));
    expect(wrapper.find('.toast').text()).toBe('Доступ открыт: Иван Новиков');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.findAll('.count-badge').map((node) => node.text())).toEqual(['1', '1']);
    const member = mock.state().members.find((m) => m.email === 'pending@uk.ru')!;
    expect(member).toMatchObject({ role: 'dispatcher', status: 'active', scope: { all: true, houseIds: [] } });
    expect(mock.mails()).toEqual(['pending@uk.ru']);
  });

  it('флажок письма снят — письма нет', async () => {
    const { wrapper, mock } = await panelOpen();
    await wrapper.findAll('.checklist input')[0]!.setValue(true);
    await wrapper.find('.panel__body label.check input').setValue(false);
    await button(wrapper, 'Подтвердить доступ').trigger('click');
    await vi.waitFor(() => expect(wrapper.find('[role=dialog]').exists()).toBe(false));
    expect(mock.mails()).toEqual([]);
  });

  it('двойное нажатие даёт один запрос', async () => {
    const { wrapper, mock } = await panelOpen();
    let release: () => void = () => undefined;
    const approve = vi.spyOn(mock.admin, 'approveAccessRequest').mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    await wrapper.findAll('.checklist input')[0]!.setValue(true);
    const submit = button(wrapper, 'Подтвердить доступ');
    await submit.trigger('click');
    await submit.trigger('click');
    expect(approve).toHaveBeenCalledTimes(1);
    expect(submit.attributes('disabled')).toBeDefined();
    release();
    await flushPromises();
  });

  it('заявку уже обработали: панель закрывается, сообщение, список обновлён', async () => {
    const { wrapper, mock } = await panelOpen();
    vi.spyOn(mock.admin, 'approveAccessRequest').mockRejectedValue(new ApiError('already_processed'));
    await wrapper.findAll('.checklist input')[0]!.setValue(true);
    await button(wrapper, 'Подтвердить доступ').trigger('click');
    await vi.waitFor(() => expect(wrapper.find('[role=dialog]').exists()).toBe(false));
    expect(wrapper.find('.toast').text()).toBe('Заявка уже обработана');
  });

  it('нет сети: сообщение в панели, введённое сохранено', async () => {
    const { wrapper, mock } = await panelOpen();
    vi.spyOn(mock.admin, 'approveAccessRequest').mockRejectedValue(new ApiError('network'));
    await wrapper.find('select').setValue('executor');
    await wrapper.findAll('.checklist input')[0]!.setValue(true);
    await button(wrapper, 'Подтвердить доступ').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role=dialog] .alert').text()).toContain('Нет соединения');
    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('executor');
    expect(button(wrapper, 'Подтвердить доступ').attributes('disabled')).toBeUndefined();
  });

  it('Esc закрывает панель и возвращает фокус на кнопку строки', async () => {
    const { wrapper } = await panelOpen();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(wrapper.find('[role=dialog]').exists()).toBe(false);
    expect(document.activeElement?.textContent).toBe('Подтвердить');
  });

  it('Tab не выходит за панель', async () => {
    const { wrapper } = await panelOpen();
    const panel = wrapper.find('.panel').element as HTMLElement;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select'),
    );
    focusable.at(-1)!.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusable[0]);
  });

  it('отклонённую заявку можно подтвердить позже, «Отклонить» скрыта', async () => {
    const { wrapper, mock } = await panelOpen('manager@uk.ru', '/staff/access?status=rejected', 'request-3');
    expect(wrapper.find('[role=dialog]').text()).not.toContain('Отклонить');
    await wrapper.findAll('.checklist input')[0]!.setValue(true);
    await button(wrapper, 'Подтвердить доступ').trigger('click');
    await vi.waitFor(() => expect(wrapper.find('[role=dialog]').exists()).toBe(false));
    expect(mock.state().members.some((m) => m.email === 'rejected@uk.ru')).toBe(true);
  });
});

describe('заявки на доступ: отклонение', () => {
  it('диалог с подтверждением; отмена ничего не меняет', async () => {
    const { wrapper, mock } = await openAs('manager@uk.ru', '/staff/access');
    await vi.waitFor(() => expect(rowFor(wrapper, 'request-1').exists()).toBe(true));
    await button(rowFor(wrapper, 'request-1') as never, 'Отклонить').trigger('click');
    const dialog = wrapper.find('[role=alertdialog]');
    expect(dialog.text()).toContain('Отклонить заявку от Иван Новиков?');
    expect(dialog.text()).toContain('Сотрудник не сможет войти');
    expect((document.activeElement as HTMLElement).textContent?.trim()).toBe('Отмена');
    await button(dialog as never, 'Отмена').trigger('click');
    expect(wrapper.find('[role=alertdialog]').exists()).toBe(false);
    expect(mock.state().requests.find((r) => r.id === 'request-1')!.status).toBe('pending');
  });

  it('подтверждённое отклонение переносит заявку в «Отклонённые», вход говорит «Доступ не открыт»', async () => {
    const { wrapper, mock } = await openAs('manager@uk.ru', '/staff/access');
    await vi.waitFor(() => expect(rowFor(wrapper, 'request-1').exists()).toBe(true));
    await button(rowFor(wrapper, 'request-1') as never, 'Отклонить').trigger('click');
    await button(wrapper.find('[role=alertdialog]') as never, 'Отклонить').trigger('click');
    await vi.waitFor(() => expect(wrapper.find('[role=alertdialog]').exists()).toBe(false));
    expect(wrapper.find('.toast').text()).toBe('Заявка отклонена');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    await expect(
      mock.auth.login({ email: 'pending@uk.ru', password: 'Password1', remember: false }),
    ).rejects.toMatchObject({ code: 'rejected' });
  });

  it('отклонение из панели: сначала диалог, потом закрываются оба окна', async () => {
    const { wrapper } = await panelOpen();
    await button(wrapper.find('.panel') as never, 'Отклонить').trigger('click');
    expect(wrapper.find('[role=alertdialog]').exists()).toBe(true);
    // Esc закрывает только верхнее окно — диалог, панель остаётся
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(wrapper.find('[role=alertdialog]').exists()).toBe(false);
    expect(wrapper.find('[role=dialog]').exists()).toBe(true);
    await button(wrapper.find('.panel') as never, 'Отклонить').trigger('click');
    await button(wrapper.find('[role=alertdialog]') as never, 'Отклонить').trigger('click');
    await vi.waitFor(() => expect(wrapper.find('[role=dialog]').exists()).toBe(false));
  });
});
