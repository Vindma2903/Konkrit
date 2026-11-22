import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { attachmentLimits } from '@/config';

export type AttachmentKind = 'image' | 'video' | 'document';

export type PickedFile = {
  uri: string;
  name: string;
  /** Размер в байтах; системный выбор не всегда его сообщает. */
  size?: number;
  mimeType?: string;
  kind: AttachmentKind;
};

export type PickResult =
  | { status: 'cancelled' }
  | { status: 'denied'; source: 'camera' | 'library' }
  | { status: 'picked'; files: PickedFile[] };

export type MediaMode = 'image' | 'video' | 'any';

/** Выбор файлов. Отдельным интерфейсом, чтобы в тестах подменять системные окна. */
export interface Pickers {
  takeMedia(mode: MediaMode): Promise<PickResult>;
  pickFromGallery(input: { limit: number; mode: MediaMode }): Promise<PickResult>;
  pickDocument(): Promise<PickResult>;
  fileExists(uri: string): boolean;
  /** Удалить локальную копию из кэша приложения (файлы из чужих папок не трогает). */
  deleteFile(uri: string): void;
}

function mediaTypes(mode: MediaMode): ImagePicker.MediaType[] {
  if (mode === 'image') return ['images'];
  if (mode === 'video') return ['videos'];
  return ['images', 'videos'];
}

function nameFromUri(uri: string): string {
  const last = uri.split('/').pop() ?? 'file';
  return decodeURIComponent(last.split('?')[0] ?? last) || 'file';
}

/** Размер файла на устройстве: система не всегда называет его при выборе. */
function sizeOnDisk(uri: string): number | undefined {
  try {
    return new File(uri).size;
  } catch {
    return undefined;
  }
}

function fromAssets(assets: ImagePicker.ImagePickerAsset[]): PickedFile[] {
  return assets.map((asset) => ({
    uri: asset.uri,
    name: asset.fileName ?? nameFromUri(asset.uri),
    size: asset.fileSize ?? sizeOnDisk(asset.uri),
    mimeType: asset.mimeType,
    kind: asset.type === 'video' ? 'video' : 'image',
  }));
}

const expoPickers: Pickers = {
  async takeMedia(mode) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'denied', source: 'camera' };
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: mediaTypes(mode) });
    if (result.canceled) return { status: 'cancelled' };
    return { status: 'picked', files: fromAssets(result.assets) };
  },

  async pickFromGallery({ limit, mode }) {
    // Системная галерея без доступа не открывается только после окончательного отказа.
    const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!permission.granted && !permission.canAskAgain)
      return { status: 'denied', source: 'library' };
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypes(mode),
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
    });
    if (result.canceled) {
      // Отказ в системном запросе доступа выглядит как закрытое окно: отличаем его по статусу.
      const after = await ImagePicker.getMediaLibraryPermissionsAsync();
      return after.status === 'denied'
        ? { status: 'denied', source: 'library' }
        : { status: 'cancelled' };
    }
    return { status: 'picked', files: fromAssets(result.assets) };
  },

  async pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [...attachmentLimits.documentMimeTypes],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return { status: 'cancelled' };
    return {
      status: 'picked',
      files: result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? sizeOnDisk(asset.uri),
        mimeType: asset.mimeType,
        kind: 'document' as const,
      })),
    };
  },

  deleteFile(uri) {
    try {
      if (uri.startsWith(Paths.cache.uri)) new File(uri).delete();
    } catch {
      // Файла уже нет или он занят: удалять нечего.
    }
  },

  fileExists(uri) {
    try {
      return new File(uri).exists;
    } catch {
      return false;
    }
  },
};

let current: Pickers = expoPickers;

export function getPickers(): Pickers {
  return current;
}

/** Подменить выбор файлов (тесты). */
export function setPickers(pickers: Pickers | null) {
  current = pickers ?? expoPickers;
}
