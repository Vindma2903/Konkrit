import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Category } from '@/api';

import type { AttachmentKind } from './pickers';

export type AttachmentError = 'network' | 'missing' | 'rejected';

export type Attachment = {
  localId: string;
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  kind: AttachmentKind;
  status: 'uploading' | 'uploaded' | 'failed';
  /** Доля загруженного, 0..1. */
  progress: number;
  /** Идентификатор на сервере после загрузки. */
  remoteId?: string;
  error?: AttachmentError;
};

type DraftData = {
  category: Category | null;
  description: string;
  /** Выбранный для этой заявки адрес; null — основной. */
  residencyId: string | null;
  attachments: Attachment[];
  /** Чей это черновик: при смене жителя чужой черновик стирается. */
  ownerId: string | null;
  /** Ключ идемпотентности: повтор отправки не создаёт вторую заявку. Живёт, пока заявка не создана. */
  requestKey: string | null;
};

type DraftState = DraftData & {
  setCategory: (category: Category | null) => void;
  setDescription: (description: string) => void;
  setResidencyId: (residencyId: string | null) => void;
  addAttachments: (items: Attachment[]) => void;
  updateAttachment: (localId: string, patch: Partial<Attachment>) => void;
  removeAttachment: (localId: string) => void;
  setOwnerId: (ownerId: string | null) => void;
  /** Ключ заявки: создаётся при первой отправке и остаётся тем же при повторах. */
  ensureRequestKey: () => string;
  reset: () => void;
};

const initial: DraftData = {
  category: null,
  description: '',
  residencyId: null,
  attachments: [],
  ownerId: null,
  requestKey: null,
};

function newRequestKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

const STORAGE_KEY = 'konkrit.requestDraft';
const WRITE_DELAY_MS = 500;

let pending: { key: string; value: string } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Записать отложенное немедленно: например, когда приложение уходит в фон. */
export async function flushDraftWrites(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const job = pending;
  pending = null;
  if (job) await AsyncStorage.setItem(job.key, job.value);
}

/** Запись с задержкой: печать не должна писать в хранилище на каждую букву. */
const debouncedStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => {
    pending = { key, value };
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flushDraftWrites().catch(() => undefined), WRITE_DELAY_MS);
    return Promise.resolve();
  },
  removeItem: async (key: string) => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
    await AsyncStorage.removeItem(key);
  },
};

/**
 * Черновик заявки: сохраняется на устройстве и переживает перезапуск.
 * Загрузка, которая шла в момент закрытия, не продолжится: такой файл становится «не загрузилось».
 */
export const useRequestDraft = create<DraftState>()(
  persist(
    (set, get) => ({
      ...initial,
      setCategory: (category) => set({ category }),
      setDescription: (description) => set({ description }),
      setResidencyId: (residencyId) => set({ residencyId }),
      addAttachments: (items) =>
        set((state) => ({ attachments: [...state.attachments, ...items] })),
      updateAttachment: (localId, patch) =>
        set((state) => ({
          attachments: state.attachments.map((item) =>
            item.localId === localId ? { ...item, ...patch } : item,
          ),
        })),
      removeAttachment: (localId) =>
        set((state) => ({
          attachments: state.attachments.filter((item) => item.localId !== localId),
        })),
      setOwnerId: (ownerId) => set({ ownerId }),
      ensureRequestKey: () => {
        const existing = get().requestKey;
        if (existing) return existing;
        const created = newRequestKey();
        set({ requestKey: created });
        return created;
      },
      reset: () => set({ ...initial }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state): DraftData => ({
        category: state.category,
        description: state.description,
        residencyId: state.residencyId,
        attachments: state.attachments,
        ownerId: state.ownerId,
        requestKey: state.requestKey,
      }),
      // Запись не читается: форма пустая, повреждённая копия удаляется, жителю об этом не сообщаем.
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          void AsyncStorage.removeItem(STORAGE_KEY);
          useRequestDraft.setState({ ...initial });
        }
      },
      merge: (saved, current) => {
        const data = (saved ?? {}) as Partial<DraftData>;
        return {
          ...current,
          category: data.category ?? null,
          description: typeof data.description === 'string' ? data.description : '',
          residencyId: typeof data.residencyId === 'string' ? data.residencyId : null,
          ownerId: typeof data.ownerId === 'string' ? data.ownerId : null,
          requestKey: typeof data.requestKey === 'string' ? data.requestKey : null,
          attachments: (Array.isArray(data.attachments) ? data.attachments : []).map((item) =>
            item.status === 'uploading'
              ? { ...item, status: 'failed' as const, progress: 0, error: 'network' as const }
              : item,
          ),
        };
      },
    },
  ),
);

/** Форма «грязная»: есть что терять при выходе. */
export function isDraftDirty(
  state: Pick<DraftData, 'category' | 'description' | 'attachments'>,
): boolean {
  return (
    state.category !== null || state.description.trim().length > 0 || state.attachments.length > 0
  );
}

/** Стереть сохранённую копию и дождаться удаления. */
export async function clearDraftStorage(): Promise<void> {
  await debouncedStorage.removeItem(STORAGE_KEY);
}
