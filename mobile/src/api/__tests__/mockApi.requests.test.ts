import { createMockApi } from '../mockApi';

const file = { uri: 'file:///photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg', size: 1000 };

describe('mockApi: категории, вложения, заявка', () => {
  it('отдаёт категории из макета', async () => {
    const api = createMockApi({ delayMs: 0 });
    const list = await api.getCategories();
    expect(list.map((item) => item.name)).toEqual([
      'Протечка',
      'Отопление',
      'Лифт',
      'Электрика',
      'Сантехника',
      'Домофон',
      'Другое',
    ]);
  });

  it('первая привязка основная, следующие нет', async () => {
    const api = createMockApi({ delayMs: 0 });
    const base = { apartment: '1', role: 'owner', verification: 'receipt' } as const;
    await api.submitResidency({ houseId: 'house-1', ...base });
    await api.submitResidency({ houseId: 'house-2', ...base });
    const list = await api.getResidencies();
    expect(list.map((item) => item.primary)).toEqual([true, false]);
  });

  it('загрузка сообщает прогресс по возрастанию и заканчивается идентификатором', async () => {
    const api = createMockApi({ delayMs: 0 });
    const progress: number[] = [];
    const result = await api.uploadAttachment({
      file,
      onProgress: (value) => progress.push(value),
    });
    expect(result.id).toMatch(/^attachment-/);
    expect(progress[0]).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(1);
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);
  });

  it('отмена прерывает загрузку с кодом aborted', async () => {
    const api = createMockApi({ delayMs: 0 });
    const controller = new AbortController();
    const upload = api.uploadAttachment({
      file,
      signal: controller.signal,
      onProgress: (value) => {
        if (value >= 0.3) controller.abort();
      },
    });
    await expect(upload).rejects.toMatchObject({ code: 'aborted' });
  });

  it('каждая N-я загрузка падает, если включён режим ошибок', async () => {
    const api = createMockApi({ delayMs: 0, failUploadEvery: 3 });
    await expect(api.uploadAttachment({ file })).resolves.toBeDefined();
    await expect(api.uploadAttachment({ file })).resolves.toBeDefined();
    await expect(api.uploadAttachment({ file })).rejects.toMatchObject({ code: 'network' });
  });

  it('создание заявки возвращает номер, время, статус и срок ответа', async () => {
    const api = createMockApi({ delayMs: 0 });
    const first = await api.createRequest({
      categoryId: 'heating',
      description: 'Нет отопления',
      residencyId: 'residency-1',
      attachmentIds: [],
      clientRequestId: 'key-1',
    });
    const second = await api.createRequest({
      categoryId: 'heating',
      description: 'Нет отопления',
      residencyId: 'residency-1',
      attachmentIds: ['attachment-1'],
      clientRequestId: 'key-2',
    });
    expect(first).toMatchObject({ status: 'new', answerWithinMin: 15 });
    expect(Number.isNaN(Date.parse(first.createdAt))).toBe(false);
    expect(second.number).toBe(first.number + 1);
  });

  it('повтор с тем же ключом возвращает ту же заявку и не создаёт вторую', async () => {
    const api = createMockApi({ delayMs: 0 });
    const input = {
      categoryId: 'heating',
      description: 'Нет отопления',
      residencyId: 'residency-1',
      attachmentIds: [],
      clientRequestId: 'same-key',
    };
    const first = await api.createRequest(input);
    const second = await api.createRequest(input);
    const third = await api.createRequest({ ...input, clientRequestId: 'other-key' });
    expect(second).toEqual(first);
    expect(third.number).toBe(first.number + 1);
  });
});
