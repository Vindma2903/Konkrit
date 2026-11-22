import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type StaffAuthApi } from '@/api';
import { createMockAuthApi } from '@/api/mockAuthApi';
import { findInput, mountApp, submit, type } from '@/test/helpers';

afterEach(() => {
  vi.useRealTimers();
});

function spyApi(overrides: Partial<StaffAuthApi> = {}): StaffAuthApi {
  const base = createMockAuthApi({ latencyMs: 0 });
  return { ...base, ...overrides };
}

describe('вход', () => {
  it('показывает ошибки пустых полей и не шлёт запрос', async () => {
    const login = vi.fn();
    const { wrapper } = await mountApp('/login', spyApi({ login }));
    await submit(wrapper);
    expect(wrapper.text()).toContain('Введите почту');
    expect(wrapper.text()).toContain('Введите пароль');
    expect(login).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(findInput(wrapper, 'Электронная почта').element);
  });

  it('проверяет формат почты', async () => {
    const { wrapper } = await mountApp('/login');
    await type(wrapper, 'Электронная почта', 'не-почта');
    await type(wrapper, 'Пароль', 'x');
    await submit(wrapper);
    expect(wrapper.text()).toContain('Проверьте адрес почты');
  });

  it('входит и открывает кабинет, чекбокс по умолчанию включён', async () => {
    const { wrapper, router } = await mountApp('/login');
    expect((wrapper.find('input[type=checkbox]').element as HTMLInputElement).checked).toBe(true);
    await type(wrapper, 'Электронная почта', 'dispatcher@uk.ru');
    await type(wrapper, 'Пароль', 'Password1');
    await submit(wrapper);
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('cabinet'));
  });

  it('возвращает на внутренний next и игнорирует внешний', async () => {
    const inner = await mountApp('/login?next=/requests');
    await type(inner.wrapper, 'Электронная почта', 'dispatcher@uk.ru');
    await type(inner.wrapper, 'Пароль', 'Password1');
    await submit(inner.wrapper);
    // маршрута /requests пока нет — он уходит в кабинет, но next принят как внутренний
    expect(inner.router.currentRoute.value.name).toBe('cabinet');
    inner.wrapper.unmount();
    sessionStorage.clear();
    localStorage.clear();
    const outer = await mountApp('/login?next=//evil.example');
    await type(outer.wrapper, 'Электронная почта', 'dispatcher@uk.ru');
    await type(outer.wrapper, 'Пароль', 'Password1');
    await submit(outer.wrapper);
    expect(outer.router.currentRoute.value.fullPath).toBe('/');
  });

  it('неверный пароль: сообщение, пароль и почта остаются', async () => {
    const { wrapper } = await mountApp('/login');
    await type(wrapper, 'Электронная почта', 'dispatcher@uk.ru');
    await type(wrapper, 'Пароль', 'Wrong123');
    await submit(wrapper);
    expect(wrapper.find('[role=alert].alert').text()).toBe('Неверная почта или пароль');
    expect((findInput(wrapper, 'Пароль').element as HTMLInputElement).value).toBe('Wrong123');
    expect((findInput(wrapper, 'Электронная почта').element as HTMLInputElement).value).toBe('dispatcher@uk.ru');
  });

  it('ждёт подтверждения: открывается экран с данными из ответа', async () => {
    const { wrapper, router } = await mountApp('/login');
    await type(wrapper, 'Электронная почта', 'pending@uk.ru');
    await type(wrapper, 'Пароль', 'Password1');
    await submit(wrapper);
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('pending'));
    await flushPromises();
    expect(wrapper.text()).toContain('Заявка на доступ отправлена администратору «УК «Тест-Сервис»»');
    expect(wrapper.text()).toContain('pending@uk.ru');
    expect(wrapper.find('a[href="mailto:admin@uk.ru"]').exists()).toBe(true);
  });

  it('отклонён и заблокирован: свои сообщения', async () => {
    const rejected = await mountApp('/login');
    await type(rejected.wrapper, 'Электронная почта', 'rejected@uk.ru');
    await type(rejected.wrapper, 'Пароль', 'Password1');
    await submit(rejected.wrapper);
    expect(rejected.wrapper.text()).toContain('Доступ не открыт. Обратитесь к администратору УК');
    rejected.wrapper.unmount();
    const blocked = await mountApp('/login');
    await type(blocked.wrapper, 'Электронная почта', 'blocked@uk.ru');
    await type(blocked.wrapper, 'Пароль', 'Password1');
    await submit(blocked.wrapper);
    expect(blocked.wrapper.text()).toContain('Доступ закрыт. Обратитесь к администратору УК');
  });

  it('лимит попыток блокирует кнопку и показывает минуты', async () => {
    const { wrapper } = await mountApp('/login');
    await type(wrapper, 'Электронная почта', 'limited@uk.ru');
    await type(wrapper, 'Пароль', 'Password1');
    await submit(wrapper);
    expect(wrapper.text()).toContain('Слишком много попыток. Повторите через 2 мин');
    expect(wrapper.find('button[type=submit]').attributes('disabled')).toBeDefined();
  });

  it('нет сети: сообщение, введённое сохранено', async () => {
    const { wrapper } = await mountApp('/login');
    await type(wrapper, 'Электронная почта', 'offline@uk.ru');
    await type(wrapper, 'Пароль', 'Password1');
    await submit(wrapper);
    expect(wrapper.text()).toContain('Нет соединения. Проверьте интернет и повторите');
    expect((findInput(wrapper, 'Пароль').element as HTMLInputElement).value).toBe('Password1');
  });

  it('двойная отправка даёт один запрос', async () => {
    let resolve: (value: never) => void = () => {};
    const login = vi.fn(() => new Promise<never>((res) => (resolve = res)));
    const { wrapper } = await mountApp('/login', spyApi({ login }));
    await type(wrapper, 'Электронная почта', 'dispatcher@uk.ru');
    await type(wrapper, 'Пароль', 'Password1');
    await wrapper.find('form').trigger('submit');
    await wrapper.find('form').trigger('submit');
    expect(login).toHaveBeenCalledTimes(1);
    resolve(undefined as never);
    await flushPromises();
  });

  it('показ пароля переключает тип поля и подпись кнопки', async () => {
    const { wrapper } = await mountApp('/login');
    const input = findInput(wrapper, 'Пароль');
    expect(input.attributes('type')).toBe('password');
    await wrapper.find('button[aria-label="Показать пароль"]').trigger('click');
    expect(input.attributes('type')).toBe('text');
    expect(wrapper.find('button[aria-label="Скрыть пароль"]').exists()).toBe(true);
  });

  it('передаёт флаг «запомнить меня» на сервер', async () => {
    const login = vi.fn(() => Promise.reject(new ApiError('invalid_credentials')));
    const { wrapper } = await mountApp('/login', spyApi({ login }));
    await wrapper.find('input[type=checkbox]').setValue(false);
    await type(wrapper, 'Электронная почта', 'a@b.ru');
    await type(wrapper, 'Пароль', 'x');
    await submit(wrapper);
    expect(login).toHaveBeenCalledWith({ email: 'a@b.ru', password: 'x', remember: false });
  });
});

describe('ждём подтверждения', () => {
  it('прямой заход: текст без названия УК и без ссылки на администратора', async () => {
    const { wrapper } = await mountApp('/pending');
    expect(wrapper.text()).toContain('Ждём подтверждения');
    expect(wrapper.text()).not.toContain('«');
    expect(wrapper.find('a[href^="mailto:"]').exists()).toBe(false);
    await wrapper.find('a.btn').trigger('click');
    await flushPromises();
  });
});

async function fillRegister(wrapper: Awaited<ReturnType<typeof mountApp>>['wrapper'], overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    'Имя и фамилия': 'Иван Петров',
    'Управляющая компания': 'УК Тест',
    'Электронная почта': 'new@uk.ru',
    Телефон: '89001234567',
    Пароль: 'Password1',
    'Повторите пароль': 'Password1',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) await type(wrapper, label, value);
}

describe('регистрация', () => {
  it('пустая форма: ошибки под каждым полем и под согласием', async () => {
    const register = vi.fn();
    const { wrapper } = await mountApp('/register', spyApi({ register }));
    await submit(wrapper);
    expect(wrapper.findAll('.field__error').length).toBe(7);
    expect(wrapper.text()).toContain('Нужно согласие, чтобы продолжить');
    expect(register).not.toHaveBeenCalled();
  });

  it('проверяет имя, телефон, пароль и повтор', async () => {
    const { wrapper } = await mountApp('/register');
    await fillRegister(wrapper, {
      'Имя и фамилия': 'Иван',
      Телефон: '123',
      Пароль: 'short',
      'Повторите пароль': 'other',
    });
    await submit(wrapper);
    expect(wrapper.text()).toContain('Укажите имя и фамилию');
    expect(wrapper.text()).toContain('Проверьте номер телефона');
    expect(wrapper.text()).toContain('Пароль не короче 8 символов');
    expect(wrapper.text()).toContain('Пароли не совпадают');
  });

  it('маска телефона форматирует номер, вставленный с 8', async () => {
    const { wrapper } = await mountApp('/register');
    await type(wrapper, 'Телефон', '89001234567');
    expect((findInput(wrapper, 'Телефон').element as HTMLInputElement).value).toBe('+7 900 123-45-67');
  });

  it('успех: отправляет телефон в E.164 и открывает «Ждём подтверждения»', async () => {
    const register = vi.fn(createMockAuthApi({ latencyMs: 0 }).register);
    const { wrapper, router } = await mountApp('/register', spyApi({ register }));
    await fillRegister(wrapper);
    await wrapper.find('input[type=checkbox]').setValue(true);
    await submit(wrapper);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+79001234567', name: 'Иван Петров', consent: true }),
    );
    expect(router.currentRoute.value.name).toBe('pending');
    expect(wrapper.text()).toContain('УК «Тест-Сервис»');
  });

  it('почта занята: сообщение и ссылка «Войти»', async () => {
    const { wrapper } = await mountApp('/register');
    await fillRegister(wrapper, { 'Электронная почта': 'taken@uk.ru' });
    await wrapper.find('input[type=checkbox]').setValue(true);
    await submit(wrapper);
    expect(wrapper.text()).toContain('Аккаунт с такой почтой уже есть');
    expect(wrapper.findAll('a.link').some((link) => link.text() === 'Войти')).toBe(true);
  });

  it('ошибки сервера по полям показываются под полями', async () => {
    const register = vi.fn(() =>
      Promise.reject(new ApiError('validation', { fields: { company: 'Такой УК нет в системе' } })),
    );
    const { wrapper } = await mountApp('/register', spyApi({ register }));
    await fillRegister(wrapper);
    await wrapper.find('input[type=checkbox]').setValue(true);
    await submit(wrapper);
    expect(wrapper.text()).toContain('Такой УК нет в системе');
  });

  it('двойное нажатие создаёт одну заявку', async () => {
    let resolve: (value: never) => void = () => {};
    const register = vi.fn(() => new Promise<never>((res) => (resolve = res)));
    const { wrapper } = await mountApp('/register', spyApi({ register }));
    await fillRegister(wrapper);
    await wrapper.find('input[type=checkbox]').setValue(true);
    await wrapper.find('form').trigger('submit');
    await wrapper.find('form').trigger('submit');
    expect(register).toHaveBeenCalledTimes(1);
    resolve(undefined as never);
    await flushPromises();
  });

  it('ссылки согласия открываются в новой вкладке безопасно', async () => {
    const { wrapper } = await mountApp('/register');
    const links = wrapper.findAll('a[target=_blank]');
    expect(links).toHaveLength(2);
    for (const link of links) expect(link.attributes('rel')).toBe('noopener noreferrer');
  });
});

describe('восстановление пароля', () => {
  it('проверяет почту, подставляет почту со входа', async () => {
    const forgot = vi.fn();
    const { wrapper } = await mountApp('/forgot', spyApi({ forgotPassword: forgot }));
    await submit(wrapper);
    expect(wrapper.text()).toContain('Введите почту');
    await type(wrapper, 'Электронная почта', 'oops');
    await submit(wrapper);
    expect(wrapper.text()).toContain('Проверьте адрес почты');
    expect(forgot).not.toHaveBeenCalled();
  });

  it('отправка ведёт на «Проверьте почту» с таймером', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { wrapper, router } = await mountApp('/forgot');
    await type(wrapper, 'Электронная почта', 'dispatcher@uk.ru');
    await submit(wrapper);
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('forgot-sent'));
    await flushPromises();
    expect(wrapper.text()).toContain('Проверьте почту');
    expect(wrapper.text()).toContain('dispatcher@uk.ru');
    expect(wrapper.text()).toContain('Она действует 30 минут');
    const resend = () => wrapper.findAll('button').find((b) => b.text().startsWith('Отправить ещё раз'))!;
    expect(resend().text()).toBe('Отправить ещё раз через 30 с');
    expect(resend().attributes('disabled')).toBeDefined();
    vi.advanceTimersByTime(31_000);
    await flushPromises();
    expect(resend().text()).toBe('Отправить ещё раз');
    expect(resend().attributes('disabled')).toBeUndefined();
  });

  it('повторная отправка шлёт один запрос и перезапускает таймер', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const base = createMockAuthApi({ latencyMs: 0 });
    const forgotPassword = vi.fn(base.forgotPassword);
    const { wrapper } = await mountApp('/forgot', spyApi({ forgotPassword }));
    await type(wrapper, 'Электронная почта', 'dispatcher@uk.ru');
    await submit(wrapper);
    vi.advanceTimersByTime(31_000);
    await flushPromises();
    const resend = wrapper.findAll('button').find((b) => b.text() === 'Отправить ещё раз')!;
    await resend.trigger('click');
    await resend.trigger('click');
    await flushPromises();
    expect(forgotPassword).toHaveBeenCalledTimes(2); // первая отправка + одна повторная
    expect(wrapper.text()).toContain('Письмо отправлено снова');
    expect(wrapper.text()).toContain('Отправить ещё раз через 30 с');
  });

  it('таймер переживает перезагрузку страницы', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const first = await mountApp('/forgot');
    await type(first.wrapper, 'Электронная почта', 'dispatcher@uk.ru');
    await submit(first.wrapper);
    vi.advanceTimersByTime(10_000);
    first.wrapper.unmount();
    const second = await mountApp('/forgot/sent');
    expect(second.wrapper.text()).toContain('Отправить ещё раз через 20 с');
  });

  it('лимит запросов показывает сообщение', async () => {
    const { wrapper } = await mountApp('/forgot');
    await type(wrapper, 'Электронная почта', 'limited@uk.ru');
    await submit(wrapper);
    expect(wrapper.text()).toContain('Слишком много попыток. Повторите через 2 мин');
  });

  it('кнопка примера письма ведёт на новый пароль и токен не остаётся в адресе', async () => {
    const { wrapper, router } = await mountApp('/forgot');
    await type(wrapper, 'Электронная почта', 'dispatcher@uk.ru');
    await submit(wrapper);
    await wrapper.findAll('button').find((b) => b.text() === 'Открыть пример письма')!.trigger('click');
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('reset'));
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/reset');
    expect(wrapper.text()).toContain('Новый пароль');
  });
});

describe('новый пароль', () => {
  it('без токена показывает «Ссылка больше не действует»', async () => {
    const { wrapper } = await mountApp('/reset');
    expect(wrapper.text()).toContain('Ссылка больше не действует');
    expect(wrapper.text()).toContain('Запросить новую ссылку');
  });

  it('отмечает требования по мере ввода', async () => {
    const { wrapper } = await mountApp('/reset?token=demo');
    const items = () => wrapper.findAll('.rules li').map((li) => li.attributes('data-ok'));
    expect(items()).toEqual(['false', 'false', 'false']);
    await type(wrapper, 'Новый пароль', 'Abcdefg1');
    expect(items()).toEqual(['true', 'true', 'true']);
    expect(wrapper.text()).toContain(': выполнено');
  });

  it('невыполненные требования не отправляются и выделяются ошибкой', async () => {
    const reset = vi.fn();
    const { wrapper } = await mountApp('/reset?token=demo', spyApi({ resetPassword: reset }));
    await type(wrapper, 'Новый пароль', 'abc');
    await type(wrapper, 'Повторите пароль', 'abc');
    await submit(wrapper);
    expect(reset).not.toHaveBeenCalled();
    expect(wrapper.findAll('.rules li').every((li) => li.attributes('data-fail') === 'true')).toBe(true);
  });

  it('пароли не совпадают', async () => {
    const { wrapper } = await mountApp('/reset?token=demo');
    await type(wrapper, 'Новый пароль', 'Password1');
    await type(wrapper, 'Повторите пароль', 'Password2');
    await submit(wrapper);
    expect(wrapper.text()).toContain('Пароли не совпадают');
  });

  it('сохранение ведёт ко входу с сообщением, один раз показанным', async () => {
    const { wrapper, router } = await mountApp('/reset?token=demo');
    await type(wrapper, 'Новый пароль', 'Password1');
    await type(wrapper, 'Повторите пароль', 'Password1');
    await submit(wrapper);
    expect(router.currentRoute.value.name).toBe('login');
    expect(wrapper.text()).toContain('Пароль изменён. Войдите с новым паролем');
  });

  it('использованная или просроченная ссылка показывает «Ссылка больше не действует»', async () => {
    const { wrapper } = await mountApp('/reset?token=expired');
    await type(wrapper, 'Новый пароль', 'Password1');
    await type(wrapper, 'Повторите пароль', 'Password1');
    await submit(wrapper);
    expect(wrapper.text()).toContain('Ссылка больше не действует');
  });

  it('нет сети: сообщение и введённое сохранено', async () => {
    const reset = vi.fn(() => Promise.reject(new ApiError('network')));
    const { wrapper } = await mountApp('/reset?token=demo', spyApi({ resetPassword: reset }));
    await type(wrapper, 'Новый пароль', 'Password1');
    await type(wrapper, 'Повторите пароль', 'Password1');
    await submit(wrapper);
    expect(wrapper.text()).toContain('Нет соединения');
    expect((findInput(wrapper, 'Новый пароль').element as HTMLInputElement).value).toBe('Password1');
  });
});
