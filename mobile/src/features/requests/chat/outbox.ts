import { create } from 'zustand';

import { getApi, type ChatMessage } from '@/api';
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

type OutboxState = {
  /** Меняется при выходе из аккаунта: запоздавшие ответы чужой сессии игнорируются. */
  epoch: number;
  byRequest: Record<string, PendingMessage[]>;
};

/**
 * Неотправленные сообщения по заявкам. Живут вне экрана: житель мог выйти из карточки,
 * пока шла отправка, и сообщение не должно пропасть молча (останется «Не отправлено · Повторить»).
 */
export const useChatOutbox = create<OutboxState>(() => ({ epoch: 0, byRequest: {} }));

export const EMPTY_PENDING: PendingMessage[] = [];

const inFlight = new Set<string>();

export const messagesKey = (requestId: string) => ['request', requestId, 'messages'];

function patch(requestId: string, clientMessageId: string, change: Partial<PendingMessage>) {
  useChatOutbox.setState((state) => ({
    byRequest: {
      ...state.byRequest,
      [requestId]: (state.byRequest[requestId] ?? []).map((item) =>
        item.clientMessageId === clientMessageId ? { ...item, ...change } : item,
      ),
    },
  }));
}

function remove(requestId: string, clientMessageId: string) {
  useChatOutbox.setState((state) => ({
    byRequest: {
      ...state.byRequest,
      [requestId]: (state.byRequest[requestId] ?? []).filter(
        (item) => item.clientMessageId !== clientMessageId,
      ),
    },
  }));
}

/** Загрузить файл (если есть) и отправить сообщение; повтор с тем же ключом не создаёт дубль. */
export async function deliver(requestId: string, item: PendingMessage): Promise<void> {
  const id = item.clientMessageId;
  if (inFlight.has(id)) return;
  inFlight.add(id);
  const { epoch } = useChatOutbox.getState();
  const alive = () => useChatOutbox.getState().epoch === epoch;
  patch(requestId, id, { status: 'sending' });
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
      patch(requestId, id, { remoteAttachmentId: attachmentId });
    }
    const sent = await getApi().sendMessage(requestId, {
      clientMessageId: id,
      text: item.text,
      attachmentIds: attachmentId ? [attachmentId] : undefined,
    });
    if (!alive()) return;
    // Опрос мог уйти до отправки и вернуться без нового сообщения: отменяем его,
    // иначе он затрёт только что добавленное сообщение до следующего опроса.
    await queryClient.cancelQueries({ queryKey: messagesKey(requestId) });
    if (!alive()) return;
    queryClient.setQueryData<ChatMessage[]>(messagesKey(requestId), (old) =>
      old?.some((message) => message.id === sent.id) ? old : [...(old ?? []), sent],
    );
    remove(requestId, id);
  } catch {
    if (alive()) patch(requestId, id, { status: 'failed' });
  } finally {
    inFlight.delete(id);
  }
}

export function enqueueMessage(requestId: string, draft: Pick<PendingMessage, 'text' | 'file'>) {
  const item: PendingMessage = {
    clientMessageId: newClientId(),
    ...draft,
    status: 'sending',
    createdAt: new Date().toISOString(),
  };
  useChatOutbox.setState((state) => ({
    byRequest: { ...state.byRequest, [requestId]: [...(state.byRequest[requestId] ?? []), item] },
  }));
  void deliver(requestId, item);
}

export function retryMessage(requestId: string, clientMessageId: string) {
  const item = useChatOutbox
    .getState()
    .byRequest[requestId]?.find((entry) => entry.clientMessageId === clientMessageId);
  if (item) void deliver(requestId, item);
}

/** Выход из аккаунта: очередь стирается, ответы уже идущих запросов игнорируются. */
export function resetOutbox() {
  useChatOutbox.setState((state) => ({ epoch: state.epoch + 1, byRequest: {} }));
}
