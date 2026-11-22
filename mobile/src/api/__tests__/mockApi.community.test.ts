import { createMockApi } from '../mockApi';
import { ApiError } from '../types';

const newApi = (pageSize?: number) => createMockApi({ delayMs: 0, pageSize });

describe('mockApi: чаты', () => {
  it('отдаёт четыре чата дома и чат с УК, непрочитанные помечены', async () => {
    const chats = await newApi().listConversations();
    expect(chats.map((chat) => chat.title)).toEqual([
      'Весь дом',
      'Подъезд 2',
      'Совет дома',
      'Соседи',
      'Чат с УК',
    ]);
    expect(chats.filter((chat) => chat.unread).map((chat) => chat.id)).toEqual([
      'house-all',
      'entrance-2',
    ]);
    expect(chats.find((chat) => chat.kind === 'management')?.subtitle).toBe('УК «Тест-Сервис»');
  });

  it('последнее сообщение чата — в карточке, свои — «Вы»', async () => {
    const api = newApi();
    const uk = (await api.listConversations()).find((chat) => chat.id === 'management');
    expect(uk?.last?.authorName).toBe('Вы');
    expect(uk?.last?.text).toBe('Отправил фото.');
  });

  it('чата нет — not_found', async () => {
    await expect(newApi().getConversation('missing')).rejects.toMatchObject({ code: 'not_found' });
    await expect(newApi().listChatMessages('missing')).rejects.toBeInstanceOf(ApiError);
    await expect(newApi().markChatRead('missing')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('отправка добавляет сообщение, повтор с тем же ключом не создаёт дубль', async () => {
    const api = newApi();
    const first = await api.sendChatMessage('house-all', { clientMessageId: 'k1', text: ' Привет ' });
    const again = await api.sendChatMessage('house-all', { clientMessageId: 'k1', text: ' Привет ' });
    expect(again.id).toBe(first.id);
    expect(first.mine).toBe(true);
    expect(first.text).toBe('Привет');
    const messages = await api.listChatMessages('house-all');
    expect(messages.filter((message) => message.clientMessageId === 'k1')).toHaveLength(1);
  });

  it('один ключ в разных чатах — разные сообщения', async () => {
    const api = newApi();
    const a = await api.sendChatMessage('house-all', { clientMessageId: 'same', text: 'a' });
    const b = await api.sendChatMessage('management', { clientMessageId: 'same', text: 'b' });
    expect(a.id).not.toBe(b.id);
  });

  it('вложение берётся из загруженного файла', async () => {
    const api = newApi();
    const { id } = await api.uploadAttachment({
      file: { uri: 'file:///a.jpg', name: 'a.jpg', mimeType: 'image/jpeg', size: 10 },
    });
    const message = await api.sendChatMessage('management', { clientMessageId: 'f1', attachmentIds: [id] });
    expect(message.attachment).toMatchObject({ kind: 'image', name: 'a.jpg' });
    const chat = await api.getConversation('management');
    expect(chat.last?.text).toBe('Вложение');
  });

  it('открытие чата снимает «непрочитанное»', async () => {
    const api = newApi();
    await api.markChatRead('house-all');
    expect((await api.getConversation('house-all')).unread).toBe(false);
  });
});

describe('mockApi: новости', () => {
  it('новости и объявления — раздельные списки, новые сверху', async () => {
    const api = newApi();
    const news = await api.listNews({ kind: 'news' });
    const announcements = await api.listNews({ kind: 'announcement' });
    expect(news.items.every((item) => item.kind === 'news')).toBe(true);
    expect(announcements.items.every((item) => item.kind === 'announcement')).toBe(true);
    const dates = news.items.map((item) => Date.parse(item.date));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('страницы идут по курсору без повторов', async () => {
    const api = newApi(2);
    const first = await api.listNews({ kind: 'news' });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await api.listNews({ kind: 'news', cursor: first.nextCursor });
    const third = await api.listNews({ kind: 'news', cursor: second.nextCursor });
    expect(third.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items, ...third.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(5);
  });

  it('новость с текстом по абзацам; нет новости — not_found', async () => {
    const api = newApi();
    const details = await api.getNews('news-1');
    expect(details.body.length).toBeGreaterThan(1);
    await expect(api.getNews('missing')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('mockApi: профиль', () => {
  it('без привязки — только имя', async () => {
    const profile = await newApi().getProfile();
    expect(profile).toEqual({ name: 'Иван Петров', address: undefined, apartment: undefined });
  });

  it('адрес и квартира берутся из основной привязки', async () => {
    const api = newApi();
    await api.submitResidency({
      houseId: 'house-1',
      apartment: '12',
      account: '1',
      role: 'owner',
      verification: 'receipt',
    });
    const profile = await api.getProfile();
    expect(profile.address).toBe('г. Оренбург, ул. Тестовая, д. 1');
    expect(profile.apartment).toBe('12');
  });
});
