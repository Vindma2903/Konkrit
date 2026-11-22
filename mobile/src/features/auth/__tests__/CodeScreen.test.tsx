import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError, MOCK_CODE, createMockApi, setApi, type ApiClient } from '@/api';
import { renderWithProviders } from '@/test/utils';

import { CodeScreen } from '../CodeScreen';
import { useLoginDraft } from '../loginDraftStore';
import { useSessionStore } from '../sessionStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const params = jest.mocked(useLocalSearchParams);

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

const cell = (index: number) => screen.getByTestId(`otp-cell-${index}`);

async function enterCode(code: string) {
  await fireEvent.changeText(cell(0), code);
}

describe('CodeScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useLoginDraft.getState().reset();
    await useSessionStore.getState().signOut();
    params.mockReturnValue({ channel: 'phone', value: '+79991234567' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('SMS: заголовок, номер с маской, таймер и ссылки', async () => {
    setApi(fakeApi());
    await renderWithProviders(<CodeScreen />);
    expect(screen.getByText('Код из SMS', { exact: true })).toBeOnTheScreen();
    expect(screen.getByTestId('code-target')).toHaveTextContent('+7 (999) 123-45-67');
    expect(screen.getByTestId('code-timer')).toHaveTextContent('Отправить код повторно через 60 с');
    expect(screen.getByText('Изменить номер')).toBeOnTheScreen();
    expect(screen.getByText('Войти по почте')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeDisabled();
  });

  it('письмо: заголовок, адрес и ссылки по каналу почты', async () => {
    params.mockReturnValue({ channel: 'email', value: 'resident@example.ru' });
    setApi(fakeApi());
    await renderWithProviders(<CodeScreen />);
    expect(screen.getByText('Код из письма', { exact: true })).toBeOnTheScreen();
    expect(screen.getByTestId('code-target')).toHaveTextContent('resident@example.ru');
    expect(screen.getByText('Изменить почту')).toBeOnTheScreen();
    expect(screen.getByText('Войти по телефону')).toBeOnTheScreen();
  });

  it('верный код: вызывает verifyCode и сохраняет сессию', async () => {
    const verifyCode = jest.fn(createMockApi({ delayMs: 0 }).verifyCode);
    setApi(fakeApi({ verifyCode }));
    await renderWithProviders(<CodeScreen />);

    await enterCode(MOCK_CODE);

    await waitFor(() =>
      expect(verifyCode).toHaveBeenCalledWith({
        channel: 'phone',
        value: '+79991234567',
        code: MOCK_CODE,
      }),
    );
    await waitFor(() => expect(useSessionStore.getState().tokens).not.toBeNull());
    expect(verifyCode).toHaveBeenCalledTimes(1);
  });

  it('неверный код: сообщение, ячейки очищаются, сессии нет', async () => {
    const verifyCode = jest.fn().mockRejectedValue(new ApiError('invalid_code'));
    setApi(fakeApi({ verifyCode }));
    await renderWithProviders(<CodeScreen />);

    await enterCode('000000');

    expect(
      await screen.findByText('Неверный код. Проверьте и попробуйте ещё раз'),
    ).toBeOnTheScreen();
    expect(cell(0)).toHaveDisplayValue('');
    expect(useSessionStore.getState().tokens).toBeNull();
  });

  it('ошибка сети при проверке: отдельное сообщение', async () => {
    const verifyCode = jest.fn().mockRejectedValue(new ApiError('network'));
    setApi(fakeApi({ verifyCode }));
    await renderWithProviders(<CodeScreen />);

    await enterCode('123456');

    expect(
      await screen.findByText('Не удалось проверить код. Проверьте соединение и попробуйте снова'),
    ).toBeOnTheScreen();
  });

  it('таймер идёт, по окончании появляется «Отправить код ещё раз» и запрашивает код заново', async () => {
    jest.useFakeTimers();
    const requestCode = jest.fn().mockResolvedValue({ retryAfterSec: 30 });
    setApi(fakeApi({ requestCode }));
    await renderWithProviders(<CodeScreen />);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('code-timer')).toHaveTextContent(/через 59 с/);

    for (let tick = 0; tick < 59; tick += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(screen.queryByTestId('code-timer')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('code-resend'));
    await waitFor(() =>
      expect(requestCode).toHaveBeenCalledWith({ channel: 'phone', value: '+79991234567' }),
    );
    await waitFor(() => expect(screen.getByTestId('code-timer')).toHaveTextContent(/через 30 с/));
  });

  it('«Изменить номер» возвращает назад', async () => {
    setApi(fakeApi());
    await renderWithProviders(<CodeScreen />);
    await fireEvent.press(screen.getByTestId('code-change'));
    expect(router.back).toHaveBeenCalled();
  });

  it('«Войти по почте» переключает канал входа и возвращает на экран входа', async () => {
    setApi(fakeApi());
    await renderWithProviders(<CodeScreen />);
    await fireEvent.press(screen.getByTestId('code-switch'));
    expect(useLoginDraft.getState().channel).toBe('email');
    expect(router.dismissTo).toHaveBeenCalledWith('/login');
  });
});
