import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import { getApi, type ChatMessage } from '@/api';

import type { PickedFile } from '../pickers';
import {
  EMPTY_PENDING,
  enqueueMessage,
  messagesKey,
  retryMessage,
  useChatOutbox,
  type PendingMessage,
} from './outbox';

export const POLL_INTERVAL_MS = 5000;

export type { PendingMessage };

export type ChatItem =
  | { kind: 'server'; key: string; message: ChatMessage }
  | { kind: 'pending'; key: string; pending: PendingMessage };

/**
 * Переписка по заявке: сообщения сервера, опрос раз в 5 секунд, пока чат открыт,
 * и неподтверждённые сообщения жителя из очереди (она живёт вне экрана).
 */
export function useRequestChat(requestId: string, active: boolean) {
  const queryKey = useMemo(() => messagesKey(requestId), [requestId]);
  const messages = useQuery({
    queryKey,
    queryFn: () => getApi().listMessages(requestId),
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

  const pending = useChatOutbox((state) => state.byRequest[requestId] ?? EMPTY_PENDING);

  const sendText = useCallback(
    (text: string) => enqueueMessage(requestId, { text: text.trim() }),
    [requestId],
  );
  const sendFile = useCallback(
    (file: PickedFile) => enqueueMessage(requestId, { file }),
    [requestId],
  );
  const retry = useCallback(
    (clientMessageId: string) => retryMessage(requestId, clientMessageId),
    [requestId],
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
