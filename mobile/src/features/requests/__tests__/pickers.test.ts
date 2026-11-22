import * as ImagePicker from 'expo-image-picker';

import { getPickers, setPickers } from '../pickers';

const mockDelete = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  getMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get size() {
      return 7 * 1024 * 1024;
    }
    get exists() {
      return true;
    }
    delete() {
      mockDelete(this.uri);
    }
  },
}));

const picker = jest.mocked(ImagePicker);

describe('выбор файлов (настоящая реализация)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPickers(null);
  });

  it('камера: отказ в доступе даёт denied и не открывает камеру', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);
    const result = await getPickers().takeMedia('any');
    expect(result).toEqual({ status: 'denied', source: 'camera' });
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('галерея: окончательный отказ без возможности спросить заново — denied', async () => {
    picker.getMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
      status: 'denied',
    } as never);
    const result = await getPickers().pickFromGallery({ limit: 5, mode: 'any' });
    expect(result).toEqual({ status: 'denied', source: 'library' });
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('галерея: окно закрыто после отказа в системном запросе — denied, а не «ничего не произошло»', async () => {
    picker.getMediaLibraryPermissionsAsync
      .mockResolvedValueOnce({ granted: false, canAskAgain: true, status: 'undetermined' } as never)
      .mockResolvedValueOnce({ granted: false, canAskAgain: true, status: 'denied' } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
    const result = await getPickers().pickFromGallery({ limit: 5, mode: 'any' });
    expect(result).toEqual({ status: 'denied', source: 'library' });
  });

  it('галерея: обычное закрытие окна без отказа — cancelled', async () => {
    picker.getMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
      status: 'undetermined',
    } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
    const result = await getPickers().pickFromGallery({ limit: 5, mode: 'any' });
    expect(result).toEqual({ status: 'cancelled' });
  });

  it('если система не назвала размер, берёт его с диска', async () => {
    picker.getMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/a.mp4', fileName: 'a.mp4', type: 'video' }],
    } as never);
    const result = await getPickers().pickFromGallery({ limit: 5, mode: 'any' });
    expect(result).toMatchObject({
      status: 'picked',
      files: [{ name: 'a.mp4', kind: 'video', size: 7 * 1024 * 1024 }],
    });
  });

  it('удаляет только копии из кэша приложения', () => {
    getPickers().deleteFile('file:///cache/photo.jpg');
    getPickers().deleteFile('file:///storage/DCIM/original.jpg');
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith('file:///cache/photo.jpg');
  });
});
