import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { setApi, type ApiClient } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { renderWithProviders } from '@/test/utils';

import { LoginScreen } from '../LoginScreen';
import { useLoginDraft } from '../loginDraftStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

const submit = () => screen.getByRole('button', { name: 'Получить код' });

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLoginDraft.getState().reset();
  });

  it('по умолчанию режим «Телефон», кнопка неактивна', async () => {
    setApi(fakeApi());
    await renderWithProviders(<LoginScreen />);
    expect(screen.getByText('Номер телефона')).toBeOnTheScreen();
    expect(screen.getByText('Код придёт в SMS.')).toBeOnTheScreen();
    expect(submit()).toBeDisabled();
  });

  it('форматирует номер, включает кнопку и запрашивает код в формате API', async () => {
    const requestCode = jest.fn().mockResolvedValue({ retryAfterSec: 60 });
    setApi(fakeApi({ requestCode }));
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-phone'), '9991234567');
    expect(screen.getByTestId('login-phone')).toHaveDisplayValue('+7 (999) 123-45-67');
    expect(submit()).toBeEnabled();

    await fireEvent.press(submit());
    await waitFor(() =>
      expect(requestCode).toHaveBeenCalledWith({ channel: 'phone', value: '+79991234567' }),
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/code',
        params: { channel: 'phone', value: '+79991234567', retryAfter: '60' },
      }),
    );
  });

  it('режим «Почта»: другая подсказка, проверка адреса, телефон не теряется', async () => {
    setApi(fakeApi());
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-phone'), '9991234567');
    await fireEvent.press(screen.getByTestId('tab-email'));

    expect(screen.getByText('Электронная почта')).toBeOnTheScreen();
    expect(
      screen.getByText('Код придёт в письме. Проверьте папку «Спам», если не нашли.'),
    ).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('login-email'), 'не-почта');
    expect(submit()).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('login-email'), 'Resident@Example.ru');
    expect(submit()).toBeEnabled();

    await fireEvent.press(screen.getByTestId('tab-phone'));
    expect(screen.getByTestId('login-phone')).toHaveDisplayValue('+7 (999) 123-45-67');
  });

  it('почта уходит в API в нижнем регистре и без пробелов', async () => {
    const requestCode = jest.fn().mockResolvedValue({ retryAfterSec: 60 });
    setApi(fakeApi({ requestCode }));
    await renderWithProviders(<LoginScreen />);

    await fireEvent.press(screen.getByTestId('tab-email'));
    await fireEvent.changeText(screen.getByTestId('login-email'), ' Resident@Example.ru ');
    await fireEvent.press(submit());
    await waitFor(() =>
      expect(requestCode).toHaveBeenCalledWith({ channel: 'email', value: 'resident@example.ru' }),
    );
  });

  it('при ошибке сети остаётся на экране и показывает сообщение', async () => {
    const requestCode = jest.fn().mockRejectedValue(new Error('network'));
    setApi(fakeApi({ requestCode }));
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-phone'), '9991234567');
    await fireEvent.press(submit());

    expect(
      await screen.findByText('Не удалось отправить код. Проверьте соединение и попробуйте снова'),
    ).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
    expect(submit()).toBeEnabled();
  });

  it('двойное нажатие отправляет один запрос', async () => {
    let resolve: (value: { retryAfterSec: number }) => void = () => undefined;
    const requestCode = jest.fn(
      () => new Promise<{ retryAfterSec: number }>((done) => (resolve = done)),
    );
    setApi(fakeApi({ requestCode }));
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-phone'), '9991234567');
    await fireEvent.press(submit());
    await fireEvent.press(submit());
    expect(requestCode).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ retryAfterSec: 60 }));
  });
});
