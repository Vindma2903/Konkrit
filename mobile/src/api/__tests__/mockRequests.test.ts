import { createMockApi } from '../mockApi';
import { deriveTitle } from '../mockRequests';

const newApi = (pageSize?: number) => createMockApi({ delayMs: 0, pageSize });

async function createOne(api: ReturnType<typeof newApi>, description: string, key: string) {
  await api.submitResidency({
    houseId: 'house-1',
    apartment: '12',
    account: '1',
    role: 'owner',
    verification: 'receipt',
  });
  const [residency] = await api.getResidencies();
  return api.createRequest({
    categoryId: 'heating',
    description,
    residencyId: residency?.id ?? '',
    attachmentIds: [],
    clientRequestId: key,
  });
}

describe('mockApi: список заявок', () => {
  it('отдаёт демо-заявки из макета, новые сверху', async () => {
    const page = await newApi().listRequests({});
    expect(page.items.map((item) => item.title)).toEqual([
      'Не открывается дверь подъезда',
      'Холодные батареи в комнате',
      'Течёт кран на кухне',
      'Лифт не доезжает до 9 этажа',
      'Нет света в подъезде',
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('фильтрует по статусам', async () => {
    const api = newApi();
    const inWork = await api.listRequests({ statuses: ['in_progress', 'waiting'] });
    expect(inWork.items.map((item) => item.status)).toEqual(['in_progress', 'in_progress']);
    const done = await api.listRequests({ statuses: ['completed', 'cancelled'] });
    expect(done.items).toHaveLength(1);
    const fresh = await api.listRequests({ statuses: ['new'] });
    expect(fresh.items).toHaveLength(2);
  });

  it('разбивает на страницы по курсору без дублей', async () => {
    const api = newApi(2);
    const first = await api.listRequests({});
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await api.listRequests({ cursor: first.nextCursor });
    const third = await api.listRequests({ cursor: second.nextCursor });
    const ids = [...first.items, ...second.items, ...third.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(5);
    expect(third.nextCursor).toBeNull();
  });

  it('созданная из формы заявка появляется вверху списка с заголовком из описания', async () => {
    const api = newApi();
    const result = await createOne(
      api,
      'Нет горячей воды с утра. Звонил диспетчеру, не помогло.',
      'k1',
    );
    const page = await api.listRequests({});
    expect(page.items[0]).toMatchObject({
      id: result.id,
      number: result.number,
      title: 'Нет горячей воды с утра',
      categoryName: 'Отопление',
      status: 'new',
      executor: null,
    });
    const details = await api.getRequest(result.id);
    expect(details.address).toBe('г. Оренбург, ул. Тестовая, д. 1, кв. 12');
  });

  it('карточка демо-заявки: куратор, исполнитель', async () => {
    const api = newApi();
    const details = await api.getRequest('request-seed-3');
    expect(details.executor).toEqual({ name: 'Сергей Петров', position: 'сантехник' });
    expect(details.curator?.position).toBe('главный инженер');
  });

  it('неизвестная заявка даёт not_found', async () => {
    const api = newApi();
    await expect(api.getRequest('нет-такой')).rejects.toMatchObject({ code: 'not_found' });
    await expect(api.listMessages('нет-такой')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('mockApi: переписка, история, файлы', () => {
  it('в демо-заявке есть переписка из макета', async () => {
    const messages = await newApi().listMessages('request-seed-3');
    expect(messages.map((item) => [item.mine, item.text])).toEqual([
      [false, 'Принял заявку, приступаю к работе.'],
      [true, 'Спасибо, жду.'],
      [false, undefined],
    ]);
    expect(messages[2]?.attachment?.kind).toBe('image');
  });

  it('сообщение жителя добавляется, повтор с тем же ключом не создаёт дубль', async () => {
    const api = newApi();
    const first = await api.sendMessage('request-seed-3', {
      clientMessageId: 'm1',
      text: ' Когда придёте? ',
    });
    const again = await api.sendMessage('request-seed-3', {
      clientMessageId: 'm1',
      text: ' Когда придёте? ',
    });
    expect(again).toEqual(first);
    expect(first).toMatchObject({
      mine: true,
      text: 'Когда придёте?',
      author: { role: 'resident' },
    });
    const messages = await api.listMessages('request-seed-3');
    expect(messages.filter((item) => item.clientMessageId === 'm1')).toHaveLength(1);
    expect(messages).toHaveLength(4);
  });

  it('сообщение с файлом хранит вложение и пополняет «Файлы»', async () => {
    const api = newApi();
    const upload = await api.uploadAttachment({
      file: {
        uri: 'file:///cache/photo.jpg',
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 1_200_000,
      },
    });
    const sent = await api.sendMessage('request-seed-3', {
      clientMessageId: 'm2',
      attachmentIds: [upload.id],
    });
    expect(sent.attachment).toMatchObject({
      kind: 'image',
      name: 'photo.jpg',
      url: 'file:///cache/photo.jpg',
    });
    const files = await api.listFiles('request-seed-3');
    expect(files.map((item) => item.name)).toEqual(['fotootchet.jpg', 'photo.jpg']);
  });

  it('файлы, приложенные при создании заявки, видны в «Файлах»', async () => {
    const api = newApi();
    await api.submitResidency({
      houseId: 'house-1',
      apartment: '1',
      account: '1',
      role: 'owner',
      verification: 'receipt',
    });
    const [residency] = await api.getResidencies();
    const upload = await api.uploadAttachment({
      file: {
        uri: 'file:///cache/act.pdf',
        name: 'act.pdf',
        mimeType: 'application/pdf',
        size: 100,
      },
    });
    const result = await api.createRequest({
      categoryId: 'leak',
      description: 'Течёт труба',
      residencyId: residency?.id ?? '',
      attachmentIds: [upload.id],
      clientRequestId: 'k2',
    });
    const files = await api.listFiles(result.id);
    expect(files).toMatchObject([{ name: 'act.pdf', kind: 'document' }]);
  });

  it('история: новые события сверху, у демо-заявки есть назначения', async () => {
    const history = await newApi().listHistory('request-seed-3');
    expect(history.map((item) => item.text)).toEqual([
      'Статус изменён: В работе',
      'Назначен исполнитель: Сергей Петров',
      'Назначен куратор: Ольга Смирнова',
      'Заявка создана',
    ]);
  });
});

describe('deriveTitle', () => {
  it('берёт первую фразу', () => {
    expect(deriveTitle('Нет отопления. Батареи холодные.')).toBe('Нет отопления');
    expect(deriveTitle('Течёт кран\nна кухне')).toBe('Течёт кран');
  });

  it('обрезает длинное до 60 символов с многоточием', () => {
    const title = deriveTitle('а'.repeat(100));
    expect(title).toHaveLength(58);
    expect(title.endsWith('…')).toBe(true);
  });

  it('без знаков препинания берёт текст целиком', () => {
    expect(deriveTitle('  Холодные батареи  ')).toBe('Холодные батареи');
  });
});
