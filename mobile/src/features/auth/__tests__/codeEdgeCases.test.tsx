import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { ApiError, setApi, type ApiClient } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { formatPhone } from '@/lib/phone';
import { renderWithProviders } from '@/test/utils';

import { CodeScreen } from '../CodeScreen';
import { useLoginDraft } from '../loginDraftStore';
import { useSessionStore } from '../sessionStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
  Redirect: jest.fn(() => null),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const params = jest.mocked(useLocalSearchParams);

function openCode(channel: 'phone' | 'email', value: string, retryAfter?: string) {
  const draft = useLoginDraft.getState();
  draft.reset();
  draft.setChannel(channel);
  if (channel === 'phone') draft.setPhone(formatPhone(value));
  else draft.setEmail(value);
  params.mockReturnValue(retryAfter ? { retryAfter } : {});
}

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

const cell = (index: number) => screen.getByTestId(`otp-cell-${index}`);

describe('CodeScreen: крайние случаи', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await useSessionStore.getState().signOut();
    openCode('phone', '+79991234567', '60');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('при сбое сети введённый код не стирается и ячейки не краснеют как при неверном коде', async () => {
    const verifyCode = jest.fn().mockRejectedValue(new ApiError('network'));
    setApi(fakeApi({ verifyCode }));
    await renderWithProviders(<CodeScreen />);

    await fireEvent.changeText(cell(0), '123456');

    expect(
      await screen.findByText('Не удалось проверить код. Проверьте соединение и попробуйте снова'),
    ).toBeOnTheScreen();
    expect(cell(0)).toHaveDisplayValue('1');
    expect(cell(5)).toHaveDisplayValue('6');
    // Кнопка «Подтвердить» остаётся доступной для повтора.
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeEnabled();
  });

  it('таймер стартует с времени, которое назвал сервер', async () => {
    openCode('phone', '+79991234567', '120');
    setApi(fakeApi());
    await renderWithProviders(<CodeScreen />);
    expect(screen.getByTestId('code-timer')).toHaveTextContent(/через 120 с/);
  });

  it('без параметра времени ожидания таймер стартует с 60 секунд', async () => {
    openCode('phone', '+79991234567');
    setApi(fakeApi());
    await renderWithProviders(<CodeScreen />);
    expect(screen.getByTestId('code-timer')).toHaveTextContent(/через 60 с/);
  });

  it('если при повторной отправке сервер просит подождать, таймер берёт его время', async () => {
    jest.useFakeTimers();
    const requestCode = jest.fn().mockRejectedValue(new ApiError('rate_limited', undefined, 45));
    setApi(fakeApi({ requestCode }));
    await renderWithProviders(<CodeScreen />);

    for (let tick = 0; tick < 60; tick += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    await fireEvent.press(screen.getByTestId('code-resend'));

    await waitFor(() => expect(screen.getByTestId('code-timer')).toHaveTextContent(/через 45 с/));
    expect(screen.getByText('Слишком много попыток. Повторите через 45 с')).toBeOnTheScreen();
  });

  it('сбой записи в защищённое хранилище не считается провалом входа', async () => {
    const SecureStore = jest.requireMock('expo-secure-store') as {
      setItemAsync: jest.Mock;
    };
    SecureStore.setItemAsync.mockRejectedValueOnce(new Error('storage full'));
    setApi(fakeApi());
    await renderWithProviders(<CodeScreen />);

    await fireEvent.changeText(cell(0), '123456');

    await waitFor(() => expect(useSessionStore.getState().tokens).not.toBeNull());
    expect(
      screen.queryByText('Не удалось проверить код. Проверьте соединение и попробуйте снова'),
    ).not.toBeOnTheScreen();
  });

  it('без введённого номера или почты возвращает ко входу', async () => {
    useLoginDraft.getState().reset();
    setApi(fakeApi());
    await renderWithProviders(<CodeScreen />);
    expect(jest.mocked(Redirect).mock.calls[0]?.[0]).toMatchObject({ href: '/login' });
  });

  it('смена способа на экране входа не меняет открытый экран кода', async () => {
    setApi(fakeApi());
    await renderWithProviders(<CodeScreen />);
    await act(async () => useLoginDraft.getState().setChannel('email'));
    expect(screen.getByTestId('code-target')).toHaveTextContent('+7 (999) 123-45-67');
    expect(Redirect).not.toHaveBeenCalled();
  });
});
