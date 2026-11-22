import { ApiError, setApi, type ApiClient } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { queryClient } from '@/lib/queryClient';

import {
  channelMessagesKey,
  chatChannel,
  enqueueMessage,
  requestChannel,
  resetOutbox,
  retryMessage,
  useChatOutbox,
} from '../chat/outbox';

function api(overrides: Partial<ApiClient> = {}): ApiClient {
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  resetOutbox();
  queryClient.clear();
});

describe('каналы очереди сообщений', () => {
  it('ключи кэша разных каналов не пересекаются', () => {
    expect(channelMessagesKey(requestChannel('7'))).toEqual(['request', '7', 'messages']);
    expect(channelMessagesKey(chatChannel('7'))).toEqual(['chat', '7', 'messages']);
  });

  it('сообщение чата уходит в sendChatMessage и попадает в кэш чата, а не заявки', async () => {
    const sendChatMessage = jest.fn(api().sendChatMessage);
    const sendMessage = jest.fn();
    setApi(api({ sendChatMessage, sendMessage }));
    enqueueMessage(chatChannel('house-all'), { text: 'Привет' });
    await flush();
    await flush();
    expect(sendChatMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
    const cached = queryClient.getQueryData<{ text?: string }[]>(['chat', 'house-all', 'messages']);
    expect(cached?.map((message) => message.text)).toEqual(['Привет']);
    expect(queryClient.getQueryData(['request', 'house-all', 'messages'])).toBeUndefined();
    expect(useChatOutbox.getState().byChannel[chatChannel('house-all')]).toEqual([]);
  });

  it('ошибка в одном канале не трогает очередь другого', async () => {
    const real = api();
    setApi(
      api({
        sendChatMessage: () => Promise.reject(new ApiError('network')),
        sendMessage: real.sendMessage,
      }),
    );
    enqueueMessage(chatChannel('management'), { text: 'не уйдёт' });
    enqueueMessage(requestChannel('request-seed-3'), { text: 'уйдёт' });
    await flush();
    await flush();
    const state = useChatOutbox.getState().byChannel;
    expect(state[chatChannel('management')]?.[0]?.status).toBe('failed');
    expect(state[requestChannel('request-seed-3')]).toEqual([]);
  });

  it('повтор отправляет то же сообщение с тем же ключом, дубля нет', async () => {
    const real = api();
    let fail = true;
    const sendChatMessage = jest.fn((id: string, input: Parameters<ApiClient['sendChatMessage']>[1]) =>
      fail ? Promise.reject(new ApiError('network')) : real.sendChatMessage(id, input),
    );
    setApi(api({ sendChatMessage }));
    enqueueMessage(chatChannel('management'), { text: 'ещё раз' });
    await flush();
    await flush();
    const [item] = useChatOutbox.getState().byChannel[chatChannel('management')] ?? [];
    expect(item?.status).toBe('failed');
    fail = false;
    retryMessage(chatChannel('management'), item?.clientMessageId ?? '');
    await flush();
    await flush();
    const keys = sendChatMessage.mock.calls.map((call) => call[1].clientMessageId);
    expect(new Set(keys).size).toBe(1);
    const messages = await real.listChatMessages('management');
    expect(messages.filter((message) => message.text === 'ещё раз')).toHaveLength(1);
  });

  it('выход стирает очередь всех каналов', async () => {
    setApi(api({ sendChatMessage: () => Promise.reject(new ApiError('network')) }));
    enqueueMessage(chatChannel('management'), { text: 'a' });
    await flush();
    await flush();
    resetOutbox();
    expect(useChatOutbox.getState().byChannel).toEqual({});
  });
});
