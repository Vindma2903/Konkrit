import {
  ApiError,
  type ChatMessage,
  type HistoryEvent,
  type ListRequestsInput,
  type MessageAttachment,
  type RequestDetails,
  type RequestFile,
  type RequestsPage,
  type RequestSummary,
  type SendMessageInput,
} from './types';

/** Сведения о загруженном файле, которые мок запоминает при загрузке. */
export type UploadedFile = {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

type Stored = {
  details: RequestDetails;
  messages: ChatMessage[];
  history: HistoryEvent[];
  files: RequestFile[];
};

const HOUR = 3_600_000;

/** Заголовок заявки из описания: первая фраза, не длиннее 60 символов. */
export function deriveTitle(description: string): string {
  const text = description.trim();
  const first = text.split(/[.!?\n]/)[0]?.trim() || text;
  return first.length > 60 ? `${first.slice(0, 57).trimEnd()}…` : first;
}

function kindOf(file: UploadedFile): MessageAttachment['kind'] {
  if (file.mimeType?.startsWith('image/')) return 'image';
  if (file.mimeType?.startsWith('video/')) return 'video';
  return 'document';
}

const curator = { name: 'Ольга Смирнова', position: 'главный инженер' };

/**
 * Заявки, переписка, история и файлы мока. Хранятся в памяти; в начале лежат демо-заявки из макета,
 * чтобы экраны можно было проверить без бэкенда.
 */
export function createMockRequests({ pageSize = 20 }: { pageSize?: number } = {}) {
  const store = new Map<string, Stored>();
  const sentMessages = new Map<string, ChatMessage>();
  let messageCounter = 0;
  let eventCounter = 0;

  const event = (at: Date, text: string): HistoryEvent => ({
    id: `event-${(eventCounter += 1)}`,
    at: at.toISOString(),
    text,
  });

  function seed(
    id: string,
    number: number,
    hoursAgo: number,
    fields: Pick<RequestDetails, 'title' | 'categoryName' | 'status' | 'executor' | 'curator'>,
    extra: { messages?: ChatMessage[]; steps?: string[] } = {},
  ) {
    const createdAt = new Date(Date.now() - hoursAgo * HOUR);
    const history = [event(createdAt, 'Заявка создана')];
    (extra.steps ?? []).forEach((text, index) => {
      history.push(event(new Date(createdAt.getTime() + (index + 1) * HOUR), text));
    });
    const messages = extra.messages ?? [];
    store.set(id, {
      details: {
        id,
        number,
        createdAt: createdAt.toISOString(),
        address: 'г. Оренбург, ул. Тестовая, д. 1, кв. 12',
        ...fields,
      },
      messages,
      history,
      files: messages.flatMap((message) =>
        message.attachment
          ? [{ ...message.attachment, id: message.attachment.id } satisfies RequestFile]
          : [],
      ),
    });
  }

  const message = (
    text: string | undefined,
    mine: boolean,
    role: ChatMessage['author']['role'],
    attachment?: MessageAttachment,
  ): ChatMessage => {
    messageCounter += 1;
    return {
      id: `message-${messageCounter}`,
      author: { role, name: mine ? undefined : role === 'executor' ? 'Сергей Петров' : undefined },
      mine,
      text,
      attachment,
      createdAt: new Date(Date.now() - (30 - messageCounter) * 60_000).toISOString(),
    };
  };

  seed('request-seed-1', 905, 2, {
    title: 'Не открывается дверь подъезда',
    categoryName: 'Домофон',
    status: 'new',
    executor: null,
    curator: null,
  });
  seed('request-seed-2', 904, 6, {
    title: 'Холодные батареи в комнате',
    categoryName: 'Отопление',
    status: 'new',
    executor: null,
    curator: null,
  });
  seed(
    'request-seed-3',
    903,
    26,
    {
      title: 'Течёт кран на кухне',
      categoryName: 'Протечка',
      status: 'in_progress',
      executor: { name: 'Сергей Петров', position: 'сантехник' },
      curator,
    },
    {
      steps: [
        'Назначен куратор: Ольга Смирнова',
        'Назначен исполнитель: Сергей Петров',
        'Статус изменён: В работе',
      ],
      messages: [
        message('Принял заявку, приступаю к работе.', false, 'executor'),
        message('Спасибо, жду.', true, 'resident'),
        message(undefined, false, 'executor', {
          id: 'seed-photo-1',
          kind: 'image',
          name: 'fotootchet.jpg',
          url: 'https://example.com/seed-photo-1.jpg',
          size: 1_400_000,
        }),
      ],
    },
  );
  seed('request-seed-4', 902, 50, {
    title: 'Лифт не доезжает до 9 этажа',
    categoryName: 'Лифт',
    status: 'in_progress',
    executor: { name: 'Андрей Козлов', position: 'лифтёр' },
    curator,
  });
  seed('request-seed-5', 901, 100, {
    title: 'Нет света в подъезде',
    categoryName: 'Электрика',
    status: 'completed',
    executor: { name: 'Игорь Волков', position: 'электрик' },
    curator,
  });

  const sorted = () =>
    [...store.values()]
      .map((item) => item.details)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const summary = (details: RequestDetails): RequestSummary => ({
    id: details.id,
    number: details.number,
    title: details.title,
    categoryName: details.categoryName,
    status: details.status,
    executor: details.executor,
    createdAt: details.createdAt,
  });

  function entry(id: string): Stored {
    const found = store.get(id);
    if (!found) throw new ApiError('not_found');
    return found;
  }

  return {
    add(details: RequestDetails, files: RequestFile[]) {
      store.set(details.id, {
        details,
        messages: [],
        history: [event(new Date(details.createdAt), 'Заявка создана')],
        files,
      });
    },

    list({ statuses, cursor }: ListRequestsInput): RequestsPage {
      const all = sorted().filter((item) => !statuses || statuses.includes(item.status));
      const start = cursor ? Number(cursor) || 0 : 0;
      const items = all.slice(start, start + pageSize).map(summary);
      const next = start + pageSize;
      return { items, nextCursor: next < all.length ? String(next) : null };
    },

    get(id: string): RequestDetails {
      return entry(id).details;
    },

    messages(id: string): ChatMessage[] {
      return [...entry(id).messages];
    },

    send(
      id: string,
      input: SendMessageInput,
      lookup: (attachmentId: string) => UploadedFile | undefined,
    ): ChatMessage {
      const stored = entry(id);
      // Повтор с тем же ключом возвращает то же сообщение.
      const existing = sentMessages.get(`${id}:${input.clientMessageId}`);
      if (existing) return existing;

      const file = input.attachmentIds?.[0] ? lookup(input.attachmentIds[0]) : undefined;
      const attachment: MessageAttachment | undefined = file
        ? {
            id: input.attachmentIds?.[0] ?? '',
            kind: kindOf(file),
            name: file.name,
            url: file.uri,
            size: file.size,
          }
        : undefined;
      messageCounter += 1;
      const sent: ChatMessage = {
        id: `message-${messageCounter}`,
        clientMessageId: input.clientMessageId,
        author: { role: 'resident' },
        mine: true,
        text: input.text?.trim() || undefined,
        attachment,
        createdAt: new Date().toISOString(),
      };
      stored.messages.push(sent);
      if (attachment) stored.files.push(attachment);
      sentMessages.set(`${id}:${input.clientMessageId}`, sent);
      return sent;
    },

    history(id: string): HistoryEvent[] {
      return [...entry(id).history].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    },

    files(id: string): RequestFile[] {
      return [...entry(id).files];
    },
  };
}
