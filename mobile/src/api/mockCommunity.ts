import type { UploadedFile } from './mockRequests';
import {
  ApiError,
  type ChatMessage,
  type Conversation,
  type ConversationKind,
  type ListNewsInput,
  type MessageAttachment,
  type NewsDetails,
  type NewsItem,
  type NewsPage,
  type SendMessageInput,
} from './types';

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Chat = {
  id: string;
  kind: ConversationKind;
  title: string;
  subtitle: string;
  unread: boolean;
  messages: ChatMessage[];
};

function kindOf(file: UploadedFile): MessageAttachment['kind'] {
  if (file.mimeType?.startsWith('image/')) return 'image';
  if (file.mimeType?.startsWith('video/')) return 'video';
  return 'document';
}

const HOUSE_ADDRESS = 'г. Оренбург, ул. Тестовая, д. 1';

/**
 * Чаты дома и с УК, новости и объявления мока. Данные придуманы для проверки без бэкенда;
 * в памяти, сбрасываются вместе с приложением.
 */
export function createMockCommunity({ pageSize = 20 }: { pageSize?: number } = {}) {
  const now = Date.now();
  let counter = 0;
  const sent = new Map<string, ChatMessage>();

  const message = (
    minutesAgo: number,
    text: string,
    from: { mine: true } | { mine: false; role: ChatMessage['author']['role']; name?: string },
  ): ChatMessage => {
    counter += 1;
    return {
      id: `chat-message-${counter}`,
      author: from.mine ? { role: 'resident' } : { role: from.role, name: from.name },
      mine: from.mine,
      text,
      createdAt: new Date(now - minutesAgo * MINUTE).toISOString(),
    };
  };
  const neighbor = (name: string) => ({ mine: false as const, role: 'resident' as const, name });
  const office = { mine: false as const, role: 'dispatcher' as const, name: 'Управляющая компания' };

  const chats: Chat[] = [
    {
      id: 'house-all',
      kind: 'house',
      title: 'Весь дом',
      subtitle: HOUSE_ADDRESS,
      unread: true,
      messages: [
        message(300, 'Добрый день! Завтра отключат горячую воду с 10 до 16.', neighbor('Мария Орлова')),
        message(45, 'Спасибо, что предупредили.', neighbor('Пётр Смирнов')),
        message(12, 'Кто-нибудь знает, когда починят лифт?', neighbor('Алексей Ким')),
      ],
    },
    {
      id: 'entrance-2',
      kind: 'entrance',
      title: 'Подъезд 2',
      subtitle: HOUSE_ADDRESS,
      unread: true,
      messages: [
        message(2000, 'Нашлись ключи от велосипедной на втором этаже.', neighbor('Елена Попова')),
        message(90, 'Сегодня во дворе оставили коробки, заберите, пожалуйста.', neighbor('Дмитрий Иванов')),
      ],
    },
    {
      id: 'council',
      kind: 'council',
      title: 'Совет дома',
      subtitle: HOUSE_ADDRESS,
      unread: false,
      messages: [
        message(3000, 'Собрание совета дома в четверг в 19:00.', neighbor('Ирина Захарова')),
      ],
    },
    {
      id: 'neighbors',
      kind: 'neighbors',
      title: 'Соседи',
      subtitle: HOUSE_ADDRESS,
      unread: false,
      messages: [message(6000, 'Отдам детскую кроватку, самовывоз.', neighbor('Олег Новиков'))],
    },
    {
      id: 'management',
      kind: 'management',
      title: 'Чат с УК',
      subtitle: 'УК «Тест-Сервис»',
      unread: false,
      messages: [
        message(
          60,
          'Здравствуйте! Подскажите, когда придёт мастер по заявке № 903?',
          { mine: true },
        ),
        message(55, 'Здравствуйте, Иван. Уточняем у исполнителя, сообщим в этом чате.', office),
        message(50, 'Хорошо, жду. Могу приложить ещё фото протечки.', { mine: true }),
        message(48, 'Да, пришлите, пожалуйста.', office),
        message(47, 'Отправил фото.', { mine: true }),
      ],
    },
  ];

  const find = (id: string): Chat => {
    const chat = chats.find((item) => item.id === id);
    if (!chat) throw new ApiError('not_found');
    return chat;
  };

  const toConversation = (chat: Chat): Conversation => {
    const last = chat.messages[chat.messages.length - 1];
    return {
      id: chat.id,
      kind: chat.kind,
      title: chat.title,
      subtitle: chat.subtitle,
      unread: chat.unread,
      last: last
        ? {
            authorName: last.mine ? 'Вы' : (last.author.name ?? 'Управляющая компания'),
            text: last.text ?? (last.attachment ? 'Вложение' : ''),
            at: last.createdAt,
          }
        : null,
    };
  };

  const newsBody = (topic: string) => [
    `${topic}. Подробности для жителей дома: уточняйте у управляющей компании или в чате дома.`,
    'Мы сообщаем об этом заранее, чтобы вы могли спланировать свои дела. Просим отнестись с пониманием.',
    'Если у вас остались вопросы, напишите в чат с управляющей компанией, мы ответим в рабочее время.',
  ];

  const news: NewsDetails[] = [
    ['news-1', 'news', 'Плановое отключение горячей воды', 1],
    ['news-2', 'news', 'Начался ремонт лифта в подъезде 2', 3],
    ['news-3', 'news', 'Итоги общего собрания собственников', 8],
    ['news-4', 'news', 'Уборка территории: график на месяц', 20],
    ['news-5', 'news', 'Новая парковочная схема во дворе', 400],
    ['announcement-1', 'announcement', 'Собрание совета дома в четверг', 2],
    ['announcement-2', 'announcement', 'Субботник во дворе', 6],
    ['announcement-3', 'announcement', 'Сбор показаний счётчиков до 25 числа', 12],
  ].map(([id, kind, title, daysAgo]) => ({
    id: String(id),
    kind: kind as NewsItem['kind'],
    title: String(title),
    preview: `${String(title)}. Что нужно знать жителям дома и какие даты важно запомнить.`,
    date: new Date(now - Number(daysAgo) * DAY).toISOString(),
    body: newsBody(String(title)),
  }));

  const toItem = ({ body: _body, ...item }: NewsDetails): NewsItem => item;

  return {
    conversations: () => chats.map(toConversation),

    conversation: (id: string) => toConversation(find(id)),

    messages: (id: string): ChatMessage[] => [...find(id).messages],

    send(
      id: string,
      input: SendMessageInput,
      lookup: (attachmentId: string) => UploadedFile | undefined,
    ): ChatMessage {
      const chat = find(id);
      const key = `${id}:${input.clientMessageId}`;
      const existing = sent.get(key);
      if (existing) return existing;
      const file = input.attachmentIds?.[0] ? lookup(input.attachmentIds[0]) : undefined;
      counter += 1;
      const created: ChatMessage = {
        id: `chat-message-${counter}`,
        clientMessageId: input.clientMessageId,
        author: { role: 'resident' },
        mine: true,
        text: input.text?.trim() || undefined,
        attachment: file
          ? {
              id: input.attachmentIds?.[0] ?? '',
              kind: kindOf(file),
              name: file.name,
              url: file.uri,
              size: file.size,
            }
          : undefined,
        createdAt: new Date().toISOString(),
      };
      chat.messages.push(created);
      sent.set(key, created);
      return created;
    },

    markRead(id: string) {
      find(id).unread = false;
    },

    news({ kind, cursor }: ListNewsInput): NewsPage {
      const all = news
        .filter((item) => item.kind === kind)
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      const start = cursor ? Number(cursor) || 0 : 0;
      const next = start + pageSize;
      return {
        items: all.slice(start, next).map(toItem),
        nextCursor: next < all.length ? String(next) : null,
      };
    },

    newsItem(id: string): NewsDetails {
      const found = news.find((item) => item.id === id);
      if (!found) throw new ApiError('not_found');
      return found;
    },
  };
}
