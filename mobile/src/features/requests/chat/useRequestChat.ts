import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getApi, type ChatMessage } from '@/api';
import { newClientId } from '@/lib/id';

import type { PickedFile } from '../pickers';

export const POLL_INTERVAL_MS = 5000;

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

export type ChatItem =
  | { kind: 'server'; key: string; message: ChatMessage }
  | { kind: 'pending'; key: string; pending: PendingMessage };

/**
 * Переписка по заявке: сообщения сервера, опрос раз в 5 секунд, пока чат открыт,
 * и неподтверждённые сообщения жителя (отправка, ошибка, повтор с тем же ключом).
 */
export function useRequestChat(requestId: string, active: boolean) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['request', requestId, 'messages'], [requestId]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const inFlight = useRef(new Set<string>());

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

  const patch = useCallback((clientMessageId: string, change: Partial<PendingMessage>) => {
    setPending((list) =>
      list.map((item) =>
        item.clientMessageId === clientMessageId ? { ...item, ...change } : item,
      ),
    );
  }, []);

  const deliver = useCallback(
    async (item: PendingMessage) => {
      const id = item.clientMessageId;
      if (inFlight.current.has(id)) return;
      inFlight.current.add(id);
      patch(id, { status: 'sending' });
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
          attachmentId = uploaded.id;
          patch(id, { remoteAttachmentId: attachmentId });
        }
        const sent = await getApi().sendMessage(requestId, {
          clientMessageId: id,
          text: item.text,
          attachmentIds: attachmentId ? [attachmentId] : undefined,
        });
        queryClient.setQueryData<ChatMessage[]>(queryKey, (old) =>
          old?.some((message) => message.id === sent.id) ? old : [...(old ?? []), sent],
        );
        setPending((list) => list.filter((entry) => entry.clientMessageId !== id));
      } catch {
        patch(id, { status: 'failed' });
      } finally {
        inFlight.current.delete(id);
      }
    },
    [patch, queryClient, queryKey, requestId],
  );

  const enqueue = useCallback(
    (draft: Pick<PendingMessage, 'text' | 'file'>) => {
      const item: PendingMessage = {
        clientMessageId: newClientId(),
        ...draft,
        status: 'sending',
        createdAt: new Date().toISOString(),
      };
      setPending((list) => [...list, item]);
      void deliver(item);
    },
    [deliver],
  );

  const sendText = useCallback((text: string) => enqueue({ text: text.trim() }), [enqueue]);
  const sendFile = useCallback((file: PickedFile) => enqueue({ file }), [enqueue]);

  const retry = useCallback(
    (clientMessageId: string) => {
      const item = pending.find((entry) => entry.clientMessageId === clientMessageId);
      if (item) void deliver(item);
    },
    [deliver, pending],
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
