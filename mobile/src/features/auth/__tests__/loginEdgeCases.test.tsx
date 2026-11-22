import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError, setApi, type ApiClient } from '@/api';
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

describe('LoginScreen: крайние случаи', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLoginDraft.getState().reset();
  });

  it('переключение вкладки во время запроса не ломает кнопку', async () => {
    const resolvers: ((value: { retryAfterSec: number }) => void)[] = [];
    const requestCode = jest.fn(
      () => new Promise<{ retryAfterSec: number }>((done) => resolvers.push(done)),
    );
    setApi(fakeApi({ requestCode }));
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-phone'), '9991234567');
    await fireEvent.press(submit());
    expect(requestCode).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('tab-email'));
    await fireEvent.press(screen.getByTestId('tab-phone'));
    await act(async () => resolvers[0]?.({ retryAfterSec: 60 }));

    // Запрос завершился: кнопка снова работает и шлёт новый запрос.
    await waitFor(() => expect(submit()).toBeEnabled());
    await fireEvent.press(submit());
    expect(requestCode).toHaveBeenCalledTimes(2);
  });

  it('ошибка показывается только у того способа, с которым случилась', async () => {
    const requestCode = jest.fn().mockRejectedValue(new Error('network'));
    setApi(fakeApi({ requestCode }));
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-phone'), '9991234567');
    await fireEvent.press(submit());
    expect(
      await screen.findByText('Не удалось отправить код. Проверьте соединение и попробуйте снова'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('tab-email'));
    expect(
      screen.queryByText('Не удалось отправить код. Проверьте соединение и попробуйте снова'),
    ).not.toBeOnTheScreen();
  });

  it('если сервер просит подождать, показывает сколько секунд', async () => {
    const requestCode = jest.fn().mockRejectedValue(new ApiError('rate_limited', undefined, 30));
    setApi(fakeApi({ requestCode }));
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-phone'), '9991234567');
    await fireEvent.press(submit());

    expect(
      await screen.findByText('Слишком много попыток. Повторите через 30 с'),
    ).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('передаёт на экран кода время ожидания, которое назвал сервер', async () => {
    const requestCode = jest.fn().mockResolvedValue({ retryAfterSec: 120 });
    setApi(fakeApi({ requestCode }));
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId('login-phone'), '9991234567');
    await fireEvent.press(submit());

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/code',
        params: { retryAfter: '120' },
      }),
    );
  });
});
