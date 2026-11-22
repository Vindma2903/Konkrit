import { act, configure, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError, setApi, type ApiClient, type ChatMessage, type Conversation } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { queryClient } from '@/lib/queryClient';
import { renderWithProviders } from '@/test/utils';

import { resetOutbox, useChatOutbox } from '../../requests/chat/outbox';
import { POLL_INTERVAL_MS } from '../../requests/chat/useChannelChat';
import { conversationsKey } from '../ChatsScreen';
import { ConversationScreen } from '../ConversationScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
  useFocusEffect: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

configure({ asyncUtilTimeout: 5000 });

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function api(overrides: Partial<ApiClient> = {}): ApiClient {
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

function open(id: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetOutbox();
  open('management');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('переписка: чат с УК', () => {
  it('шапка с названием УК, сообщения по порядку со временем, без имён авторов', async () => {
    setApi(api());
    await renderWithProviders(<ConversationScreen />);
    expect(screen.getByTestId('conversation-loading')).toHaveTextContent('Загружаем переписку…');

    expect(await screen.findByText('Чат с УК')).toBeOnTheScreen();
    expect(screen.getByTestId('conversation-subtitle')).toHaveTextContent('УК «Тест-Сервис»');
    expect(await screen.findByText('Отправил фото.')).toBeOnTheScreen();
    expect(screen.getByText('Да, пришлите, пожалуйста.')).toBeOnTheScreen();
    // имён нет: ни «Вы», ни названия УК над сообщениями
    expect(screen.queryByText('Вы')).toBeNull();
    expect(screen.queryByText('Управляющая компания')).toBeNull();
    // у каждого подтверждённого сообщения время
    expect(screen.getAllByTestId(/^message-chat-message-\d+-time$/).length).toBeGreaterThanOrEqual(5);
  });

  it('пустая переписка: «Сообщений пока нет. Напишите первым»', async () => {
    setApi(api({ listChatMessages: async () => [] }));
    await renderWithProviders(<ConversationScreen />);
    expect(await screen.findByTestId('chat-empty')).toHaveTextContent(
      'Сообщений пока нет. Напишите первым',
    );
  });
});

describe('переписка: групповой чат', () => {
  it('над сообщением другого жителя его имя, адрес дома в шапке', async () => {
    open('house-all');
    setApi(api());
    await renderWithProviders(<ConversationScreen />);
    expect(await screen.findByText('Мария Орлова')).toBeOnTheScreen();
    expect(screen.getByText('Алексей Ким')).toBeOnTheScreen();
    expect(screen.getByTestId('conversation-subtitle')).toHaveTextContent(
      'г. Оренбург, ул. Тестовая, д. 1',
    );
    expect(screen.getByText('Весь дом')).toBeOnTheScreen();
  });

  it('своё сообщение без имени', async () => {
    open('house-all');
    setApi(api());
    await renderWithProviders(<ConversationScreen />);
    await screen.findByText('Мария Орлова');
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Всем привет');
    await fireEvent.press(screen.getByTestId('chat-send'));
    expect(await screen.findByText('Всем привет')).toBeOnTheScreen();
    expect(screen.queryByText('Вы')).toBeNull();
  });
});

describe('переписка: отправка', () => {
  it('сразу «Отправляется…», поле очищено; после ответа пометка исчезает и появляется время', async () => {
    const real = createMockApi({ delayMs: 0 });
    let release: (message: ChatMessage) => void = () => undefined;
    const sendChatMessage = jest.fn(
      () =>
        new Promise<ChatMessage>((resolve) => {
          release = resolve;
        }),
    );
    setApi(api({ sendChatMessage }));
    await renderWithProviders(<ConversationScreen />);
    await screen.findByText('Отправил фото.');

    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Здравствуйте!');
    await fireEvent.press(screen.getByTestId('chat-send'));
    expect(screen.getByTestId('chat-input').props.value).toBe('');
    const pending = (await screen.findAllByText('Отправляется…'))[0];
    expect(pending).toBeOnTheScreen();

    const sent = await real.sendChatMessage('management', { clientMessageId: 'x', text: 'Здравствуйте!' });
    await act(async () => release(sent));
    await waitFor(() => expect(screen.queryByText('Отправляется…')).toBeNull());
    expect(screen.getAllByText('Здравствуйте!')).toHaveLength(1);
    expect(screen.getByTestId(`message-${sent.id}-time`)).toBeOnTheScreen();
  });

  it('ошибка: «Не отправлено · Повторить», повтор с тем же ключом без дубля', async () => {
    const real = createMockApi({ delayMs: 0 });
    let fail = true;
    const sendChatMessage = jest.fn((id: string, input: Parameters<ApiClient['sendChatMessage']>[1]) =>
      fail ? Promise.reject(new ApiError('network')) : real.sendChatMessage(id, input),
    );
    setApi(api({ sendChatMessage, listChatMessages: real.listChatMessages }));
    await renderWithProviders(<ConversationScreen />);
    await screen.findByText('Отправил фото.');

    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Ещё раз');
    await fireEvent.press(screen.getByTestId('chat-send'));
    expect(await screen.findByText('Не отправлено · Повторить')).toBeOnTheScreen();

    fail = false;
    await fireEvent.press(screen.getByText('Не отправлено · Повторить'));
    await waitFor(() => expect(screen.queryByText('Не отправлено · Повторить')).toBeNull());
    expect(screen.getAllByText('Ещё раз')).toHaveLength(1);
    const keys = sendChatMessage.mock.calls.map((call) => call[1].clientMessageId);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('неотправленное остаётся в очереди после выхода из чата и видно при возврате', async () => {
    const sendChatMessage = jest.fn(() => Promise.reject(new ApiError('network')));
    setApi(api({ sendChatMessage }));
    const first = await renderWithProviders(<ConversationScreen />);
    await screen.findByText('Отправил фото.');
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Не потеряй меня');
    await fireEvent.press(screen.getByTestId('chat-send'));
    await screen.findByText('Не отправлено · Повторить');
    await first.unmount();

    expect(Object.values(useChatOutbox.getState().byChannel).flat()).toHaveLength(1);
    // Кэш очищает renderWithProviders; очередь живёт отдельно от экрана
    await renderWithProviders(<ConversationScreen />);
    expect(await screen.findByText('Не потеряй меня')).toBeOnTheScreen();
    expect(screen.getByText('Не отправлено · Повторить')).toBeOnTheScreen();
  });

  it('очередь чата дома не затрагивает другой чат', async () => {
    setApi(api({ sendChatMessage: () => Promise.reject(new ApiError('network')) }));
    open('house-all');
    const first = await renderWithProviders(<ConversationScreen />);
    await screen.findByText('Мария Орлова');
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Только для дома');
    await fireEvent.press(screen.getByTestId('chat-send'));
    await screen.findByText('Не отправлено · Повторить');
    await first.unmount();

    open('council');
    await renderWithProviders(<ConversationScreen />);
    await screen.findByText('Ирина Захарова');
    expect(screen.queryByText('Только для дома')).toBeNull();
  });
});

describe('переписка: прочитанное и опрос', () => {
  it('при открытии чат отмечается прочитанным, в списке пропадает точка', async () => {
    open('house-all');
    const markChatRead = jest.fn(createMockApi({ delayMs: 0 }).markChatRead);
    setApi(api({ markChatRead }));
    await renderWithProviders(<ConversationScreen />);
    const seeded: Conversation[] = [
      { id: 'house-all', kind: 'house', title: 'Весь дом', last: null, unread: true },
      { id: 'council', kind: 'council', title: 'Совет дома', last: null, unread: true },
    ];
    queryClient.setQueryData(conversationsKey, seeded);
    await screen.findByText('Мария Орлова');
    await waitFor(() => expect(markChatRead).toHaveBeenCalledWith('house-all'));
    await waitFor(() => {
      const list = queryClient.getQueryData<Conversation[]>(conversationsKey);
      expect(list?.find((item) => item.id === 'house-all')?.unread).toBe(false);
      expect(list?.find((item) => item.id === 'council')?.unread).toBe(true);
    });
  });

  it('новое сообщение на открытом экране снова отмечает чат прочитанным, а не дублируется', async () => {
    const markChatRead = jest.fn(async () => undefined);
    setApi(api({ markChatRead }));
    await renderWithProviders(<ConversationScreen />);
    await screen.findByText('Отправил фото.');
    await waitFor(() => expect(markChatRead).toHaveBeenCalledTimes(1));

    const incoming: ChatMessage = {
      id: 'incoming-1',
      author: { role: 'dispatcher', name: 'Управляющая компания' },
      mine: false,
      text: 'Мастер выехал',
      createdAt: new Date().toISOString(),
    };
    await act(async () => {
      queryClient.setQueryData<ChatMessage[]>(['chat', 'management', 'messages'], (old) => [
        ...(old ?? []),
        incoming,
      ]);
    });
    expect(await screen.findByText('Мастер выехал')).toBeOnTheScreen();
    await waitFor(() => expect(markChatRead).toHaveBeenCalledTimes(2));
    // тот же список не отмечается повторно
    await act(async () => flush());
    expect(markChatRead).toHaveBeenCalledTimes(2);
  });

  it('опрос раз в 5 секунд, пока экран на виду, и прекращается после ухода', async () => {
    const mock = createMockApi({ delayMs: 0 });
    // Снимки берём до поддельных таймеров: мок отвечает через таймер.
    const snapshot = await mock.listChatMessages('management');
    const chat = await mock.getConversation('management');
    jest.useFakeTimers();
    const listChatMessages = jest.fn(async () => snapshot);
    setApi(api({ listChatMessages, getConversation: async () => chat, markChatRead: async () => undefined }));
    await renderWithProviders(<ConversationScreen />);
    for (let step = 0; step < 5; step += 1) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10);
      });
    }
    expect(screen.getByText('Отправил фото.')).toBeOnTheScreen();
    const focusEffect = jest.mocked(useFocusEffect).mock.calls.at(-1)?.[0] as () => () => void;
    const before = listChatMessages.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
    });
    expect(listChatMessages.mock.calls.length).toBeGreaterThan(before);

    const leave = focusEffect();
    await act(async () => leave());
    const afterLeave = listChatMessages.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(listChatMessages.mock.calls.length).toBe(afterLeave);
  });
});

describe('переписка: состояния', () => {
  it('чата нет: «Чат не найден», «К чатам» открывает вкладку «Чат»', async () => {
    open('missing');
    setApi(api());
    await renderWithProviders(<ConversationScreen />);
    expect(await screen.findByText('Чат не найден')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('conversation-to-list'));
    expect(router.replace).toHaveBeenCalledWith('/chat');
  });

  it('ошибка загрузки: «Не удалось загрузить переписку» и «Повторить»', async () => {
    const real = createMockApi({ delayMs: 0 });
    let fail = true;
    setApi(
      api({
        getConversation: (id) => (fail ? Promise.reject(new ApiError('network')) : real.getConversation(id)),
      }),
    );
    await renderWithProviders(<ConversationScreen />);
    expect(await screen.findByText('Не удалось загрузить переписку')).toBeOnTheScreen();
    expect(screen.queryByText('Чат не найден')).toBeNull();

    fail = false;
    await fireEvent.press(screen.getByTestId('conversation-retry'));
    expect(await screen.findByText('Отправил фото.')).toBeOnTheScreen();
  });

  it('«Назад» возвращает к списку', async () => {
    setApi(api());
    await renderWithProviders(<ConversationScreen />);
    await screen.findByText('Отправил фото.');
    await fireEvent.press(screen.getByTestId('header-back'));
    expect(router.back).toHaveBeenCalled();
  });
});
