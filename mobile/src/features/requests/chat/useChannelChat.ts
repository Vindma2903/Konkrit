import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import type { ChatMessage } from '@/api';

import type { PickedFile } from '../pickers';
import {
  channelMessagesKey,
  EMPTY_PENDING,
  enqueueMessage,
  listChannelMessages,
  retryMessage,
  useChatOutbox,
  type ChannelId,
  type PendingMessage,
} from './outbox';

export const POLL_INTERVAL_MS = 5000;

export type { PendingMessage };

export type ChatItem =
  | { kind: 'server'; key: string; message: ChatMessage }
  | { kind: 'pending'; key: string; pending: PendingMessage };

/**
 * Переписка по каналу (заявка или чат): сообщения сервера, опрос раз в 5 секунд, пока чат
 * открыт, и неподтверждённые сообщения жителя из очереди (она живёт вне экрана).
 */
export function useChannelChat(channel: ChannelId, active: boolean) {
  const queryKey = useMemo(() => channelMessagesKey(channel), [channel]);
  const messages = useQuery({
    queryKey,
    queryFn: () => listChannelMessages(channel),
    refetchInterval: active ? POLL_INTERVAL_MS : false,
  });
  const { refetch } = messages;

  // Вернулись в приложение — сразу обновляем переписку.
  useEffect(() => {
    if (!active) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [active, refetch]);

  const pending = useChatOutbox((state) => state.byChannel[channel] ?? EMPTY_PENDING);

  const sendText = useCallback(
    (text: string) => enqueueMessage(channel, { text: text.trim() }),
    [channel],
  );
  const sendFile = useCallback((file: PickedFile) => enqueueMessage(channel, { file }), [channel]);
  const retry = useCallback(
    (clientMessageId: string) => retryMessage(channel, clientMessageId),
    [channel],
  );

  // Сообщение, которое сервер уже вернул в опросе, из неподтверждённых убираем (без дублей).
  const items: ChatItem[] = useMemo(() => {
    const server = messages.data ?? [];
    const known = new Set(server.map((message) => message.clientMessageId).filter(Boolean));
    return [
      ...server.map((message): ChatItem => ({ kind: 'server', key: message.id, message })),
      ...pending
        .filter((entry) => !known.has(entry.clientMessageId))
        .map((entry): ChatItem => ({
          kind: 'pending',
          key: entry.clientMessageId,
          pending: entry,
        })),
    ];
  }, [messages.data, pending]);

  return {
    items,
    isPending: messages.isPending,
    isError: messages.isError,
    refetch,
    sendText,
    sendFile,
    retry,
  };
}
