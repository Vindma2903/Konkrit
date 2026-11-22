import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  ApiError,
  setApi,
  type ApiClient,
  type ChatMessage,
  type RequestsPage,
  type SendMessageInput,
} from '@/api';
import { createMockApi } from '@/api/mockApi';
import { useSessionStore } from '@/features/auth/sessionStore';
import { queryClient } from '@/lib/queryClient';
import { renderWithProviders } from '@/test/utils';

import { RequestCardScreen } from '../card/RequestCardScreen';
import { ChatTab } from '../chat/ChatTab';
import { requestChannel, resetOutbox, useChatOutbox } from '../chat/outbox';
import { POLL_INTERVAL_MS } from '../chat/useChannelChat';
import { RequestsScreen } from '../RequestsScreen';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
  useFocusEffect: jest.fn(),
}));

const REQUEST = 'request-seed-3';

function api(overrides: Partial<ApiClient> = {}, pageSize?: number): ApiClient {
  return { ...createMockApi({ delayMs: 0, pageSize }), ...overrides };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
  resetOutbox();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('очередь сообщений чата', () => {
  it('сообщение не пропадает, если опрос вернулся позже ответа на отправку', async () => {
    const real = createMockApi({ delayMs: 0 });
    // Снимок переписки до отправки берём до включения поддельных таймеров (мок отвечает через таймер).
    const before = await real.listMessages(REQUEST);
    jest.useFakeTimers();
    let releaseStale: (messages: ChatMessage[]) => void = () => undefined;
    let calls = 0;
    // Опрос, запущенный до отправки, отвечает позже и без нового сообщения.
    const listMessages = jest.fn((id: string) => {
      calls += 1;
      if (calls === 2) {
        return new Promise<ChatMessage[]>((resolve) => {
          releaseStale = resolve;
        });
      }
      return real.listMessages(id);
    });
    setApi(api({ listMessages, sendMessage: real.sendMessage }));
    await renderWithProviders(<ChatTab requestId={REQUEST} active />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    // Опрос ушёл и висит.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10);
    });
    expect(calls).toBe(2);

    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Срочно!');
    await fireEvent.press(screen.getByTestId('chat-send'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(50);
    });
    await act(async () => releaseStale(before));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(50);
    });

    expect(screen.getAllByText('Срочно!')).toHaveLength(1);
  });

  it('если выйти из карточки, пока сообщение отправляется, оно остаётся с «Повторить»', async () => {
    const sendMessage = jest.fn().mockRejectedValue(new ApiError('network'));
    setApi(api({ sendMessage }));
    const first = await renderWithProviders(<ChatTab requestId={REQUEST} active />);
    await screen.findByTestId('chat-list');
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Не потеряйте меня');
    await fireEvent.press(screen.getByTestId('chat-send'));
    // Житель ушёл с экрана, не дождавшись ответа.
    first.unmount();
    await waitFor(() =>
      expect(useChatOutbox.getState().byChannel[requestChannel(REQUEST)]?.[0]?.status).toBe('failed'),
    );

    await renderWithProviders(<ChatTab requestId={REQUEST} active />);

    expect(await screen.findByText('Не потеряйте меня')).toBeOnTheScreen();
    expect(screen.getByText('Не отправлено · Повторить')).toBeOnTheScreen();
  });

  it('после возврата повтор доставляет сообщение с прежним ключом', async () => {
    const real = createMockApi({ delayMs: 0 });
    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(real.sendMessage);
    setApi(api({ sendMessage }));
    const first = await renderWithProviders(<ChatTab requestId={REQUEST} active />);
    await screen.findByTestId('chat-list');
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Ответьте');
    await fireEvent.press(screen.getByTestId('chat-send'));
    first.unmount();
    await waitFor(() =>
      expect(useChatOutbox.getState().byChannel[requestChannel(REQUEST)]?.[0]?.status).toBe('failed'),
    );
    await renderWithProviders(<ChatTab requestId={REQUEST} active />);

    await fireEvent.press(await screen.findByText('Не отправлено · Повторить'));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    const keys = sendMessage.mock.calls.map(
      ([, body]) => (body as SendMessageInput).clientMessageId,
    );
    expect(keys[1]).toBe(keys[0]);
    await waitFor(() =>
      expect(screen.queryByText('Не отправлено · Повторить')).not.toBeOnTheScreen(),
    );
  });

  it('выход из аккаунта стирает очередь и не пускает запоздавший ответ в кэш', async () => {
    let finish: (message: ChatMessage) => void = () => undefined;
    const sendMessage = jest.fn(
      () =>
        new Promise<ChatMessage>((resolve) => {
          finish = resolve;
        }),
    );
    setApi(api({ sendMessage }));
    useSessionStore.setState({
      tokens: { accessToken: 'a', refreshToken: 'r' },
      user: { id: 'user-1' },
      hasResidency: true,
    });
    await renderWithProviders(<ChatTab requestId={REQUEST} active />);
    await screen.findByTestId('chat-list');
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Секрет');
    await fireEvent.press(screen.getByTestId('chat-send'));
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());

    await act(async () => {
      await useSessionStore.getState().signOut();
    });
    expect(useChatOutbox.getState().byChannel).toEqual({});
    await act(async () =>
      finish({
        id: 'late',
        author: { role: 'resident' },
        mine: true,
        text: 'Секрет',
        createdAt: '2026-11-22T10:00:00.000Z',
      }),
    );
    await flush();

    const cached = queryClient.getQueryData<ChatMessage[]>(['request', REQUEST, 'messages']);
    expect(cached?.some((message) => message.id === 'late') ?? false).toBe(false);
  });
});

describe('карточка при сбое повторного запроса', () => {
  it('уже загруженная карточка остаётся на экране, чат не пропадает', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: REQUEST });
    const real = createMockApi({ delayMs: 0 });
    const getRequest = jest
      .fn()
      .mockImplementationOnce(real.getRequest)
      .mockRejectedValue(new ApiError('network'));
    setApi(api({ getRequest }));
    await renderWithProviders(<RequestCardScreen />);
    await screen.findByText('Заявка № 903');
    await fireEvent.changeText(await screen.findByTestId('chat-input'), 'Черновик ответа');

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['request', REQUEST], exact: true });
    });
    await flush();

    expect(getRequest).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Не удалось загрузить заявку')).not.toBeOnTheScreen();
    expect(screen.getByText('Заявка № 903')).toBeOnTheScreen();
    expect(screen.getByTestId('chat-input')).toHaveDisplayValue('Черновик ответа');
  });
});

describe('список заявок: обновление и повторы', () => {
  it('«потянуть вниз» перезапрашивает только первую страницу', async () => {
    const real = createMockApi({ delayMs: 0, pageSize: 2 });
    const listRequests = jest.fn(real.listRequests);
    setApi(api({ listRequests }, 2));
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Холодные батареи в комнате');
    await fireEvent(screen.getByTestId('requests-list'), 'endReached');
    await screen.findByText('Лифт не доезжает до 9 этажа');
    expect(listRequests).toHaveBeenCalledTimes(2);

    await fireEvent(screen.getByTestId('requests-list'), 'refresh');

    await waitFor(() => expect(listRequests).toHaveBeenCalledTimes(3));
    expect(listRequests.mock.calls[2]?.[0]).toMatchObject({ cursor: null });
    // Дальше первой страницы заявки сброшены и подгружаются снова по концу списка.
    await waitFor(() =>
      expect(screen.queryByText('Лифт не доезжает до 9 этажа')).not.toBeOnTheScreen(),
    );
  });

  it('если сервер отдал заявку на двух страницах, карточка показывается один раз', async () => {
    const real = createMockApi({ delayMs: 0, pageSize: 2 });
    const listRequests = jest.fn(async (input: Parameters<ApiClient['listRequests']>[0]) => {
      const page: RequestsPage = await real.listRequests(input);
      // Вторая страница повторяет последнюю заявку первой.
      return input.cursor
        ? { ...page, items: [(await real.listRequests({})).items[1]!, ...page.items] }
        : page;
    });
    setApi(api({ listRequests }, 2));
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Холодные батареи в комнате');

    await fireEvent(screen.getByTestId('requests-list'), 'endReached');
    await screen.findByText('Течёт кран на кухне');

    expect(screen.getAllByTestId('request-card-request-seed-2')).toHaveLength(1);
  });

  it('при возврате на вкладку список обновляется с первой страницы', async () => {
    const listRequests = jest.fn(createMockApi({ delayMs: 0 }).listRequests);
    setApi(api({ listRequests }));
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');
    const focus = jest.mocked(useFocusEffect).mock.calls.at(-1)?.[0] as () => void;

    await act(async () => focus());
    await act(async () => focus());

    await waitFor(() => expect(listRequests).toHaveBeenCalledTimes(2));
    expect(listRequests.mock.calls[1]?.[0]).toMatchObject({ cursor: null });
  });
});
