import { ApiError, setApi, type ApiClient, type UploadAttachmentInput } from '@/api';
import { createMockApi } from '@/api/mockApi';

import { useRequestDraft } from '../draftStore';
import { setPickers, type PickedFile } from '../pickers';
import {
  addAndUpload,
  discardDraft,
  removeAttachment,
  retryAllFailed,
  retryUpload,
} from '../uploader';

type Job = {
  input: UploadAttachmentInput;
  resolve: (id: string) => void;
  reject: (error: unknown) => void;
};

/** Мок загрузки, которой управляет тест: завершает и отклоняет по команде и слушает отмену. */
function controlledApi() {
  const jobs: Job[] = [];
  const api: ApiClient = {
    ...createMockApi({ delayMs: 0 }),
    uploadAttachment: (input) =>
      new Promise((resolve, reject) => {
        jobs.push({ input, resolve: (id) => resolve({ id }), reject });
        input.signal?.addEventListener('abort', () => reject(new ApiError('aborted')));
      }),
  };
  return { api, jobs };
}

const file = (name: string, kind: PickedFile['kind'] = 'image'): PickedFile => ({
  uri: `file:///${name}`,
  name,
  size: 1000,
  kind,
});

const attachments = () => useRequestDraft.getState().attachments;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const deleteFile = jest.fn();

describe('очередь загрузки вложений', () => {
  let exists = true;

  beforeEach(async () => {
    exists = true;
    setPickers({
      takeMedia: jest.fn(),
      pickFromGallery: jest.fn(),
      pickDocument: jest.fn(),
      fileExists: () => exists,
      deleteFile: deleteFile,
    });
    discardDraft();
    await flush();
  });

  afterEach(async () => {
    discardDraft();
    await flush();
    setPickers(null);
  });

  it('грузит не больше трёх файлов одновременно, остальные ждут с нуля', async () => {
    const { api, jobs } = controlledApi();
    setApi(api);

    addAndUpload(['a', 'b', 'c', 'd', 'e'].map((name) => file(`${name}.jpg`)));
    await flush();

    expect(jobs).toHaveLength(3);
    expect(attachments()).toHaveLength(5);
    expect(
      attachments()
        .slice(3)
        .map((item) => item.progress),
    ).toEqual([0, 0]);

    jobs[0]?.resolve('remote-a');
    await flush();
    expect(jobs).toHaveLength(4);
    expect(attachments()[0]).toMatchObject({
      status: 'uploaded',
      remoteId: 'remote-a',
      progress: 1,
    });
  });

  it('обновляет прогресс файла', async () => {
    const { api, jobs } = controlledApi();
    setApi(api);

    addAndUpload([file('a.jpg')]);
    await flush();
    jobs[0]?.input.onProgress?.(0.35);

    expect(attachments()[0]?.progress).toBe(0.35);
  });

  it('при ошибке файл «не загрузилось», а «Повторить» грузит его снова', async () => {
    const { api, jobs } = controlledApi();
    setApi(api);

    addAndUpload([file('a.jpg')]);
    await flush();
    jobs[0]?.reject(new ApiError('network'));
    await flush();
    expect(attachments()[0]).toMatchObject({ status: 'failed', error: 'network', progress: 0 });

    const localId = attachments()[0]?.localId ?? '';
    retryUpload(localId);
    await flush();
    expect(attachments()[0]?.status).toBe('uploading');
    expect(jobs).toHaveLength(2);

    jobs[1]?.resolve('remote-a');
    await flush();
    expect(attachments()[0]).toMatchObject({ status: 'uploaded', remoteId: 'remote-a' });
  });

  it('«Повторить все» ставит в очередь только файлы с ошибкой', async () => {
    const { api, jobs } = controlledApi();
    setApi(api);

    addAndUpload([file('a.jpg'), file('b.jpg'), file('c.jpg')]);
    await flush();
    jobs[0]?.resolve('remote-a');
    jobs[1]?.reject(new ApiError('network'));
    jobs[2]?.reject(new ApiError('network'));
    await flush();
    expect(attachments().map((item) => item.status)).toEqual(['uploaded', 'failed', 'failed']);

    retryAllFailed();
    await flush();
    expect(attachments().map((item) => item.status)).toEqual([
      'uploaded',
      'uploading',
      'uploading',
    ]);
    expect(jobs).toHaveLength(5);
  });

  it('отказ сервера по правилам файла помечается как «не принят»', async () => {
    const { api, jobs } = controlledApi();
    setApi(api);

    addAndUpload([file('a.jpg')]);
    await flush();
    jobs[0]?.reject(new ApiError('validation'));
    await flush();

    expect(attachments()[0]).toMatchObject({ status: 'failed', error: 'rejected' });
  });

  it('отмена прерывает загрузку и убирает файл без ошибки', async () => {
    const { api, jobs } = controlledApi();
    setApi(api);

    addAndUpload([file('a.jpg')]);
    await flush();
    removeAttachment(attachments()[0]?.localId ?? '');
    await flush();

    expect(jobs[0]?.input.signal?.aborted).toBe(true);
    expect(attachments()).toHaveLength(0);
  });

  it('удаление ожидающего в очереди файла не запускает его загрузку', async () => {
    const { api, jobs } = controlledApi();
    setApi(api);

    addAndUpload(['a', 'b', 'c', 'd'].map((name) => file(`${name}.jpg`)));
    await flush();
    removeAttachment(attachments()[3]?.localId ?? '');
    jobs[0]?.resolve('remote-a');
    await flush();

    expect(jobs).toHaveLength(3);
    expect(attachments()).toHaveLength(3);
  });

  it('если файла уже нет на устройстве, повтор оставляет ошибку «файл недоступен»', async () => {
    const { api, jobs } = controlledApi();
    setApi(api);

    addAndUpload([file('a.jpg')]);
    await flush();
    jobs[0]?.reject(new ApiError('network'));
    await flush();

    exists = false;
    retryUpload(attachments()[0]?.localId ?? '');
    await flush();

    expect(attachments()[0]).toMatchObject({ status: 'failed', error: 'missing' });
    expect(jobs).toHaveLength(1);
  });

  it('удаление черновика отменяет все загрузки и стирает поля', async () => {
    const { api, jobs } = controlledApi();
    setApi(api);
    useRequestDraft.getState().setDescription('Нет отопления');

    addAndUpload([file('a.jpg'), file('b.jpg')]);
    await flush();
    discardDraft();
    await flush();

    expect(jobs.every((job) => job.input.signal?.aborted)).toBe(true);
    expect(attachments()).toHaveLength(0);
    expect(useRequestDraft.getState().description).toBe('');
  });
});
