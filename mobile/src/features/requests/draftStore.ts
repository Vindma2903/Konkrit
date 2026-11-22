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
};

type DraftState = DraftData & {
  setCategory: (category: Category | null) => void;
  setDescription: (description: string) => void;
  setResidencyId: (residencyId: string | null) => void;
  addAttachments: (items: Attachment[]) => void;
  updateAttachment: (localId: string, patch: Partial<Attachment>) => void;
  removeAttachment: (localId: string) => void;
  reset: () => void;
};

const initial: DraftData = { category: null, description: '', residencyId: null, attachments: [] };

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
    (set) => ({
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
export function isDraftDirty(state: DraftData): boolean {
  return (
    state.category !== null || state.description.trim().length > 0 || state.attachments.length > 0
  );
}
