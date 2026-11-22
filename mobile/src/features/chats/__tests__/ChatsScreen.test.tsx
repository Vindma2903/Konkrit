import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useFocusEffect } from 'expo-router';

import { ApiError, setApi, type ApiClient, type Conversation } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { renderWithProviders } from '@/test/utils';

import { ChatsScreen } from '../ChatsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function api(overrides: Partial<ApiClient> = {}): ApiClient {
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

const conversation = (patch: Partial<Conversation> & Pick<Conversation, 'id'>): Conversation => ({
  kind: 'house',
  title: patch.id,
  subtitle: 'г. Оренбург',
  last: null,
  unread: false,
  ...patch,
});

beforeEach(() => jest.clearAllMocks());

describe('вкладка «Чат»: список чатов', () => {
  it('сначала «Загружаем чаты…», затем четыре чата дома и секция «Управляющая компания»', async () => {
    setApi(api());
    await renderWithProviders(<ChatsScreen />);
    expect(screen.getByTestId('chats-loading')).toHaveTextContent('Загружаем чаты…');

    expect(await screen.findByText('Весь дом')).toBeOnTheScreen();
    expect(screen.getByText('Чаты дома')).toBeOnTheScreen();
    for (const title of ['Подъезд 2', 'Совет дома', 'Соседи']) {
      expect(screen.getByText(title)).toBeOnTheScreen();
    }
    expect(screen.getByText('Управляющая компания')).toBeOnTheScreen();
    expect(screen.getByTestId('chat-management')).toBeOnTheScreen();
    // «Чат с УК» не дублируется среди чатов дома
    expect(screen.queryByTestId('conversation-management')).toBeNull();
  });

  it('карточка: «Имя Фамилия: сообщение» и непрочитанное', async () => {
    setApi(api());
    await renderWithProviders(<ChatsScreen />);
    await screen.findByText('Весь дом');
    expect(screen.getByTestId('conversation-house-all-preview')).toHaveTextContent(
      'Алексей Ким: Кто-нибудь знает, когда починят лифт?',
    );
    expect(screen.getByTestId('conversation-house-all-unread')).toBeOnTheScreen();
    expect(screen.getByTestId('conversation-house-all')).toHaveAccessibleName(
      /Есть непрочитанные/,
    );
    expect(screen.queryByTestId('conversation-council-unread')).toBeNull();
  });

  it('порядок: от недавней активности к давней, чаты без сообщений в конце', async () => {
    const now = Date.now();
    setApi(
      api({
        listConversations: async () => [
          conversation({ id: 'old', last: { authorName: 'А Б', text: 'x', at: new Date(now - 5e6).toISOString() } }),
          conversation({ id: 'empty' }),
          conversation({ id: 'new', last: { authorName: 'В Г', text: 'y', at: new Date(now - 1e3).toISOString() } }),
        ],
      }),
    );
    await renderWithProviders(<ChatsScreen />);
    await screen.findByTestId('conversation-new');
    const ids = screen
      .getAllByTestId(/^conversation-(old|empty|new)$/)
      .map((node) => node.props.testID as string);
    expect(ids).toEqual(['conversation-new', 'conversation-old', 'conversation-empty']);
  });

  it('неверная дата сообщения не ломает порядок: такой чат уходит в конец', async () => {
    const now = Date.now();
    setApi(
      api({
        listConversations: async () => [
          conversation({ id: 'broken', last: { authorName: 'А Б', text: 'x', at: 'не дата' } }),
          conversation({ id: 'a', last: { authorName: 'В Г', text: 'y', at: new Date(now - 5e6).toISOString() } }),
          conversation({ id: 'b', last: { authorName: 'Д Е', text: 'z', at: new Date(now - 1e3).toISOString() } }),
        ],
      }),
    );
    await renderWithProviders(<ChatsScreen />);
    await screen.findByTestId('conversation-b');
    const ids = screen
      .getAllByTestId(/^conversation-(broken|a|b)$/)
      .map((node) => node.props.testID as string);
    expect(ids).toEqual(['conversation-b', 'conversation-a', 'conversation-broken']);
  });

  it('чат без сообщений: «Сообщений пока нет», точки нет', async () => {
    setApi(api({ listConversations: async () => [conversation({ id: 'quiet', title: 'Тихий', unread: false })] }));
    await renderWithProviders(<ChatsScreen />);
    expect(await screen.findByTestId('conversation-quiet-preview')).toHaveTextContent('Сообщений пока нет');
    expect(screen.queryByTestId('conversation-quiet-unread')).toBeNull();
  });

  it('нажатие открывает переписку этого чата, «Чат с УК» — переписку с УК', async () => {
    setApi(api());
    await renderWithProviders(<ChatsScreen />);
    await screen.findByText('Совет дома');

    await fireEvent.press(screen.getByTestId('conversation-council'));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/chats/[id]', params: { id: 'council' } });

    await fireEvent.press(screen.getByTestId('chat-management'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/chats/[id]',
      params: { id: 'management' },
    });
  });

  it('пустой список: «Чатов пока нет», строка «Чат с УК» остаётся', async () => {
    setApi(api({ listConversations: async () => [] }));
    await renderWithProviders(<ChatsScreen />);
    expect(await screen.findByTestId('chats-empty')).toHaveTextContent('Чатов пока нет');
    expect(screen.getByTestId('chat-management')).toBeOnTheScreen();
  });

  it('ошибка: сообщение и «Повторить», «Чат с УК» остаётся доступной', async () => {
    let fail = true;
    const real = createMockApi({ delayMs: 0 });
    setApi(
      api({
        listConversations: () => (fail ? Promise.reject(new ApiError('network')) : real.listConversations()),
      }),
    );
    await renderWithProviders(<ChatsScreen />);
    expect(await screen.findByText('Не удалось загрузить чаты')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('chat-management'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/chats/[id]', params: { id: 'management' } });

    fail = false;
    await fireEvent.press(screen.getByTestId('chats-retry'));
    expect(await screen.findByText('Весь дом')).toBeOnTheScreen();
    expect(screen.queryByText('Не удалось загрузить чаты')).toBeNull();
  });

  it('при возврате на вкладку список обновляется, точка у прочитанного пропадает', async () => {
    const mock = createMockApi({ delayMs: 0 });
    const listConversations = jest.fn(mock.listConversations);
    setApi(api({ listConversations }));
    await renderWithProviders(<ChatsScreen />);
    await screen.findByText('Весь дом');
    expect(screen.getByTestId('conversation-house-all-unread')).toBeOnTheScreen();
    const focus = jest.mocked(useFocusEffect).mock.calls.at(-1)?.[0] as () => void;

    // Первый показ уже загрузил список — лишнего запроса нет
    await act(async () => focus());
    await flush();
    expect(listConversations).toHaveBeenCalledTimes(1);

    await mock.markChatRead('house-all');
    await act(async () => focus());
    await waitFor(() => expect(listConversations).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('conversation-house-all-unread')).toBeNull());
    expect(screen.getByTestId('conversation-entrance-2-unread')).toBeOnTheScreen();
  });
});
