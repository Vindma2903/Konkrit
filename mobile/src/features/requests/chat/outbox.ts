import { create } from 'zustand';

import { getApi, type ChatMessage, type SendMessageInput } from '@/api';
import { newClientId } from '@/lib/id';
import { queryClient } from '@/lib/queryClient';

import type { PickedFile } from '../pickers';

/** Сообщение жителя, которое ещё не подтверждено сервером. */
export type PendingMessage = {
  clientMessageId: string;
  text?: string;
  file?: PickedFile;
  /** Идентификатор уже загруженного файла: при повторе файл не грузится заново. */
  remoteAttachmentId?: string;
  status: 'sending' | 'failed';
  createdAt: string;
};

/** Канал переписки: `request:<id>` — чат заявки, `chat:<id>` — чат дома или с УК. */
export type ChannelId = string;

export const requestChannel = (requestId: string): ChannelId => `request:${requestId}`;
export const chatChannel = (chatId: string): ChannelId => `chat:${chatId}`;

type OutboxState = {
  /** Меняется при выходе из аккаунта: запоздавшие ответы чужой сессии игнорируются. */
  epoch: number;
  byChannel: Record<ChannelId, PendingMessage[]>;
};

/**
 * Неотправленные сообщения по каналам (заявки и чаты). Живут вне экрана: житель мог выйти
 * из переписки, пока шла отправка, и сообщение не должно пропасть молча
 * (останется «Не отправлено · Повторить»).
 */
export const useChatOutbox = create<OutboxState>(() => ({ epoch: 0, byChannel: {} }));

export const EMPTY_PENDING: PendingMessage[] = [];

const inFlight = new Set<string>();

export const messagesKey = (requestId: string) => ['request', requestId, 'messages'];

function splitChannel(channel: ChannelId): { kind: 'request' | 'chat'; id: string } {
  const index = channel.indexOf(':');
  const kind = channel.slice(0, index);
  return { kind: kind === 'chat' ? 'chat' : 'request', id: channel.slice(index + 1) };
}

/** Ключ кэша сообщений канала. */
export function channelMessagesKey(channel: ChannelId): string[] {
  const { kind, id } = splitChannel(channel);
  return [kind, id, 'messages'];
}

/** Загрузить сообщения канала. */
export function listChannelMessages(channel: ChannelId): Promise<ChatMessage[]> {
  const { kind, id } = splitChannel(channel);
  return kind === 'chat' ? getApi().listChatMessages(id) : getApi().listMessages(id);
}

function sendToChannel(channel: ChannelId, input: SendMessageInput): Promise<ChatMessage> {
  const { kind, id } = splitChannel(channel);
  return kind === 'chat' ? getApi().sendChatMessage(id, input) : getApi().sendMessage(id, input);
}

function patch(channel: ChannelId, clientMessageId: string, change: Partial<PendingMessage>) {
  useChatOutbox.setState((state) => ({
    byChannel: {
      ...state.byChannel,
      [channel]: (state.byChannel[channel] ?? []).map((item) =>
        item.clientMessageId === clientMessageId ? { ...item, ...change } : item,
      ),
    },
  }));
}

function remove(channel: ChannelId, clientMessageId: string) {
  useChatOutbox.setState((state) => ({
    byChannel: {
      ...state.byChannel,
      [channel]: (state.byChannel[channel] ?? []).filter(
        (item) => item.clientMessageId !== clientMessageId,
      ),
    },
  }));
}

/** Загрузить файл (если есть) и отправить сообщение; повтор с тем же ключом не создаёт дубль. */
export async function deliver(channel: ChannelId, item: PendingMessage): Promise<void> {
  const id = item.clientMessageId;
  if (inFlight.has(id)) return;
  inFlight.add(id);
  const { epoch } = useChatOutbox.getState();
  const alive = () => useChatOutbox.getState().epoch === epoch;
  patch(channel, id, { status: 'sending' });
  try {
    let attachmentId = item.remoteAttachmentId;
    if (item.file && !attachmentId) {
      const uploaded = await getApi().uploadAttachment({
        file: {
          uri: item.file.uri,
          name: item.file.name,
          mimeType: item.file.mimeType,
          size: item.file.size,
        },
      });
      if (!alive()) return;
      attachmentId = uploaded.id;
      patch(channel, id, { remoteAttachmentId: attachmentId });
    }
    const sent = await sendToChannel(channel, {
      clientMessageId: id,
      text: item.text,
      attachmentIds: attachmentId ? [attachmentId] : undefined,
    });
    if (!alive()) return;
    // Опрос мог уйти до отправки и вернуться без нового сообщения: отменяем его,
    // иначе он затрёт только что добавленное сообщение до следующего опроса.
    await queryClient.cancelQueries({ queryKey: channelMessagesKey(channel) });
    if (!alive()) return;
    queryClient.setQueryData<ChatMessage[]>(channelMessagesKey(channel), (old) =>
      old?.some((message) => message.id === sent.id) ? old : [...(old ?? []), sent],
    );
    remove(channel, id);
  } catch {
    if (alive()) patch(channel, id, { status: 'failed' });
  } finally {
    inFlight.delete(id);
  }
}

export function enqueueMessage(channel: ChannelId, draft: Pick<PendingMessage, 'text' | 'file'>) {
  const item: PendingMessage = {
    clientMessageId: newClientId(),
    ...draft,
    status: 'sending',
    createdAt: new Date().toISOString(),
  };
  useChatOutbox.setState((state) => ({
    byChannel: { ...state.byChannel, [channel]: [...(state.byChannel[channel] ?? []), item] },
  }));
  void deliver(channel, item);
}

export function retryMessage(channel: ChannelId, clientMessageId: string) {
  const item = useChatOutbox
    .getState()
    .byChannel[channel]?.find((entry) => entry.clientMessageId === clientMessageId);
  if (item) void deliver(channel, item);
}

/** Выход из аккаунта: очередь стирается, ответы уже идущих запросов игнорируются. */
export function resetOutbox() {
  useChatOutbox.setState((state) => ({ epoch: state.epoch + 1, byChannel: {} }));
}
