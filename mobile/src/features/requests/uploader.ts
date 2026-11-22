import { ApiError, getApi } from '@/api';
import { attachmentLimits } from '@/config';

import { clearDraftStorage, useRequestDraft, type Attachment } from './draftStore';
import { getPickers, type PickedFile } from './pickers';

/**
 * Очередь загрузки вложений: не больше N одновременно, у каждой загрузки своя отмена.
 * Состояние файлов живёт в сторе черновика, здесь только процесс.
 */
const queue: string[] = [];
const controllers = new Map<string, AbortController>();
let running = 0;
let sequence = 0;
const PROGRESS_STEP = 0.05;

const draft = () => useRequestDraft.getState();
const find = (localId: string) => draft().attachments.find((item) => item.localId === localId);

function toAttachment(file: PickedFile): Attachment {
  sequence += 1;
  return {
    localId: `att-${Date.now()}-${sequence}`,
    uri: file.uri,
    name: file.name,
    size: file.size,
    mimeType: file.mimeType,
    kind: file.kind,
    status: 'uploading',
    progress: 0,
  };
}

async function run(localId: string) {
  const item = find(localId);
  if (!item || item.status !== 'uploading') return;

  running += 1;
  const controller = new AbortController();
  controllers.set(localId, controller);
  try {
    const { id: remoteId } = await getApi().uploadAttachment({
      file: { uri: item.uri, name: item.name, mimeType: item.mimeType, size: item.size },
      signal: controller.signal,
      onProgress: (progress) => {
        // Прогресс приходит часто, а каждое обновление перерисовывает экран и пишет черновик:
        // обновляем шагами не меньше 5%.
        const current = find(localId);
        if (current && progress - current.progress >= PROGRESS_STEP) {
          draft().updateAttachment(localId, { progress });
        }
      },
    });
    if (find(localId)) {
      draft().updateAttachment(localId, {
        status: 'uploaded',
        progress: 1,
        remoteId,
        error: undefined,
      });
    }
  } catch (error) {
    // Отмена — решение жителя, ошибкой она не считается.
    if (!controller.signal.aborted && find(localId)) {
      draft().updateAttachment(localId, {
        status: 'failed',
        progress: 0,
        error: error instanceof ApiError && error.code === 'validation' ? 'rejected' : 'network',
      });
    }
  } finally {
    running -= 1;
    controllers.delete(localId);
    pump();
  }
}

function pump() {
  while (running < attachmentLimits.parallelUploads && queue.length > 0) {
    const next = queue.shift();
    if (next) void run(next);
  }
}

function enqueue(localId: string) {
  if (!queue.includes(localId)) queue.push(localId);
  pump();
}

/** Добавить выбранные файлы в черновик и начать загрузку. Проверки лимитов делает вызывающий. */
export function addAndUpload(files: PickedFile[]): Attachment[] {
  const items = files.map(toAttachment);
  draft().addAttachments(items);
  for (const item of items) enqueue(item.localId);
  return items;
}

/** Отменить загрузку или удалить загруженный файл: он исчезает из списка. */
export function removeAttachment(localId: string) {
  const item = find(localId);
  const index = queue.indexOf(localId);
  if (index >= 0) queue.splice(index, 1);
  controllers.get(localId)?.abort();
  draft().removeAttachment(localId);
  if (item) getPickers().deleteFile(item.uri);
}

/** Повторить загрузку одного файла. Если файл на устройстве исчез — остаётся с ошибкой. */
export function retryUpload(localId: string) {
  const item = find(localId);
  if (!item || item.status !== 'failed') return;
  if (!getPickers().fileExists(item.uri)) {
    draft().updateAttachment(localId, { error: 'missing' });
    return;
  }
  draft().updateAttachment(localId, { status: 'uploading', progress: 0, error: undefined });
  enqueue(localId);
}

export function retryAllFailed() {
  for (const item of draft().attachments) {
    if (item.status === 'failed') retryUpload(item.localId);
  }
}

/** Остановить все загрузки (выход, удаление черновика). */
export function cancelAllUploads() {
  queue.length = 0;
  for (const controller of controllers.values()) controller.abort();
}

/**
 * Удалить черновик целиком: загрузки, поля, локальные копии файлов и сохранённую запись.
 * Состояние очищается сразу; промис завершается, когда запись стёрта с диска.
 */
export function discardDraft(): Promise<void> {
  cancelAllUploads();
  const { attachments } = draft();
  draft().reset();
  for (const item of attachments) getPickers().deleteFile(item.uri);
  return clearDraftStorage().catch(() => undefined);
}
