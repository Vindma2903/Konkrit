import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, setApi, type ApiClient, type UploadAttachmentInput } from '@/api';
import { createMockApi } from '@/api/mockApi';

import { flushDraftWrites, useRequestDraft } from '../draftStore';
import { setPickers, type PickedFile } from '../pickers';
import { addAndUpload, discardDraft, removeAttachment } from '../uploader';

const deleteFile = jest.fn();
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function controlledApi() {
  const inputs: UploadAttachmentInput[] = [];
  const api: ApiClient = {
    ...createMockApi({ delayMs: 0 }),
    uploadAttachment: (input) =>
      new Promise((_resolve, reject) => {
        inputs.push(input);
        input.signal?.addEventListener('abort', () => reject(new ApiError('aborted')));
      }),
  };
  return { api, inputs };
}

const file = (name: string): PickedFile => ({
  uri: `file:///cache/${name}`,
  name,
  size: 1000,
  kind: 'image',
});

describe('прогресс и удаление локальных копий', () => {
  beforeEach(async () => {
    deleteFile.mockClear();
    setPickers({
      takeMedia: jest.fn(),
      pickFromGallery: jest.fn(),
      pickDocument: jest.fn(),
      fileExists: () => true,
      deleteFile,
    });
    await discardDraft();
    deleteFile.mockClear();
  });

  afterEach(async () => {
    await discardDraft();
    setPickers(null);
  });

  it('мелкие шаги прогресса не обновляют состояние, шаги от 5% — обновляют', async () => {
    const { api, inputs } = controlledApi();
    setApi(api);
    addAndUpload([file('a.jpg')]);
    await flush();
    const attachment = () => useRequestDraft.getState().attachments[0];

    inputs[0]?.onProgress?.(0.02);
    expect(attachment()?.progress).toBe(0);
    inputs[0]?.onProgress?.(0.06);
    expect(attachment()?.progress).toBe(0.06);
    inputs[0]?.onProgress?.(0.08);
    expect(attachment()?.progress).toBe(0.06);
    inputs[0]?.onProgress?.(0.5);
    expect(attachment()?.progress).toBe(0.5);
  });

  it('удаление файла из списка удаляет его локальную копию', async () => {
    const { api } = controlledApi();
    setApi(api);
    addAndUpload([file('a.jpg')]);
    await flush();

    removeAttachment(useRequestDraft.getState().attachments[0]?.localId ?? '');

    expect(deleteFile).toHaveBeenCalledWith('file:///cache/a.jpg');
  });

  it('удаление черновика стирает копии всех файлов и сохранённую запись, и ждёт её удаления', async () => {
    const { api } = controlledApi();
    setApi(api);
    useRequestDraft.getState().setDescription('Нет отопления');
    addAndUpload([file('a.jpg'), file('b.jpg')]);
    await flush();
    await flushDraftWrites();
    expect(await AsyncStorage.getItem('konkrit.requestDraft')).not.toBeNull();

    await discardDraft();

    expect(deleteFile).toHaveBeenCalledWith('file:///cache/a.jpg');
    expect(deleteFile).toHaveBeenCalledWith('file:///cache/b.jpg');
    expect(await AsyncStorage.getItem('konkrit.requestDraft')).toBeNull();
  });
});
