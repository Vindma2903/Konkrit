import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { ApiError, setApi, type ApiClient, type ChatMessage, type SendMessageInput } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { renderWithProviders } from '@/test/utils';

import { ChatTab } from '../chat/ChatTab';
import { resetOutbox } from '../chat/outbox';
import { POLL_INTERVAL_MS } from '../chat/useRequestChat';
import { setPickers, type PickedFile, type Pickers } from '../pickers';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openSettings: jest.fn(),
  openURL: jest.fn(),
}));

const MB = 1024 * 1024;
const REQUEST = 'request-seed-3';

function api(overrides: Partial<ApiClient> = {}): ApiClient {
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

function pickers(overrides: Partial<Pickers> = {}) {
  const value: Pickers = {
    takeMedia: jest.fn(),
    pickFromGallery: jest.fn(),
    pickDocument: jest.fn(),
    fileExists: () => true,
    deleteFile: jest.fn(),
    ...overrides,
  };
  setPickers(value);
  return value;
}

const photo = (name: string, size = MB): PickedFile => ({
  uri: `file:///cache/${name}`,
  name,
  size,
  mimeType: 'image/jpeg',
  kind: 'image',
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const send = () => screen.getByTestId('chat-send');
const input = () => screen.getByTestId('chat-input');

async function renderChat(active = true, request = REQUEST) {
  await renderWithProviders(<ChatTab requestId={request} active={active} />);
  await screen.findByTestId(request === REQUEST ? 'chat-list' : 'chat-empty');
}

async function type(text: string) {
  await fireEvent.changeText(input(), text);
}

async function attachFromGallery(files: PickedFile[]) {
  const p = pickers({ pickFromGallery: jest.fn().mockResolvedValue({ status: 'picked', files }) });
  await fireEvent.press(screen.getByTestId('chat-attach'));
  await fireEvent.press(screen.getByTestId('attach-gallery'));
  return p;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetOutbox();
  pickers();
});

afterEach(() => {
  jest.useRealTimers();
  setPickers(null);
});

describe('переписка', () => {
  it('чужие сообщения слева с подписью автора, свои справа с подписью «Вы»', async () => {
    setApi(api());
    await renderChat();

    expect(screen.getByText('Принял заявку, приступаю к работе.')).toBeOnTheScreen();
    expect(screen.getByText('Спасибо, жду.')).toBeOnTheScreen();
    expect(screen.getAllByText('Исполнитель').length).toBe(2);
    expect(screen.getByText('Вы')).toBeOnTheScreen();
  });

  it('сообщение с фото показывает картинку 160×96', async () => {
    setApi(api());
    await renderChat();

    const photoNode = screen.getAllByTestId(/-photo$/)[0];
    expect(photoNode).toHaveStyle({ width: 160, height: 96 });
  });

  it('документ показан строкой с именем файла', async () => {
    const messages: ChatMessage[] = [
      {
        id: 'm1',
        author: { role: 'curator' },
        mine: false,
        attachment: { id: 'a1', kind: 'document', name: 'act.pdf', url: 'file:///act.pdf' },
        createdAt: '2026-11-22T10:00:00.000Z',
      },
    ];
    setApi(api({ listMessages: jest.fn().mockResolvedValue(messages) }));
    await renderChat();

    expect(screen.getByText('act.pdf')).toBeOnTheScreen();
    expect(screen.getByText('Куратор')).toBeOnTheScreen();
  });

  it('пустой чат: подсказка', async () => {
    setApi(api());
    await renderChat(true, 'request-seed-2');
    expect(screen.getByTestId('chat-empty')).toHaveTextContent(
      'Сообщений пока нет. Напишите исполнителю или куратору',
    );
  });

  it('ошибка загрузки переписки: сообщение и «Повторить»', async () => {
    const listMessages = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(createMockApi({ delayMs: 0 }).listMessages);
    setApi(api({ listMessages }));
    await renderWithProviders(<ChatTab requestId={REQUEST} active />);

    expect(await screen.findByText('Не удалось загрузить переписку')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('chat-retry'));

    expect(await screen.findByText('Спасибо, жду.')).toBeOnTheScreen();
  });
});

describe('отправка текста', () => {
  it('«Отправить» неактивна, пока в поле пусто или только пробелы', async () => {
    setApi(api());
    await renderChat();

    expect(send()).toBeDisabled();
    await type('   ');
    expect(send()).toBeDisabled();
    await type('Привет');
    expect(send()).toBeEnabled();
  });

  it('сообщение сразу появляется с «Отправляется…», поле очищается, после ответа пометка исчезает', async () => {
    let finish: (message: ChatMessage) => void = () => undefined;
    const sendMessage = jest.fn(
      (id: string, body: SendMessageInput) =>
        new Promise<ChatMessage>((resolve) => {
          finish = () =>
            resolve({
              id: 'server-1',
              clientMessageId: body.clientMessageId,
              author: { role: 'resident' },
              mine: true,
              text: body.text,
              createdAt: '2026-11-22T10:00:00.000Z',
            });
          void id;
        }),
    );
    setApi(api({ sendMessage }));
    await renderChat();

    await type('  Когда придёте?  ');
    await fireEvent.press(send());

    expect(await screen.findByText('Когда придёте?')).toBeOnTheScreen();
    expect(screen.getByText('Отправляется…')).toBeOnTheScreen();
    expect(input()).toHaveDisplayValue('');
    expect(sendMessage).toHaveBeenCalledWith(
      REQUEST,
      expect.objectContaining({ text: 'Когда придёте?', clientMessageId: expect.any(String) }),
    );

    await act(async () => finish({} as ChatMessage));
    await waitFor(() => expect(screen.queryByText('Отправляется…')).not.toBeOnTheScreen());
    expect(screen.getAllByText('Когда придёте?')).toHaveLength(1);
  });

  it('двойное нажатие создаёт одно сообщение', async () => {
    const sendMessage = jest.fn(createMockApi({ delayMs: 0 }).sendMessage);
    setApi(api({ sendMessage }));
    await renderChat();
    await type('Привет');

    await fireEvent.press(send());
    await fireEvent.press(send());
    await flush();

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('при ошибке «Не отправлено · Повторить»; повтор уходит с тем же ключом и не создаёт дубля', async () => {
    const real = createMockApi({ delayMs: 0 });
    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(real.sendMessage);
    setApi(api({ sendMessage }));
    await renderChat();

    await type('Жду ответа');
    await fireEvent.press(send());
    expect(await screen.findByText('Не отправлено · Повторить')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Не отправлено · Повторить'));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText('Не отправлено · Повторить')).not.toBeOnTheScreen(),
    );

    const keys = sendMessage.mock.calls.map(
      ([, body]) => (body as SendMessageInput).clientMessageId,
    );
    expect(keys[1]).toBe(keys[0]);
    expect(screen.getAllByText('Жду ответа')).toHaveLength(1);
    expect((await real.listMessages(REQUEST)).filter((m) => m.text === 'Жду ответа')).toHaveLength(
      1,
    );
  });

  it('длиннее 1000 символов обрезается', async () => {
    setApi(api());
    await renderChat();
    await type('а'.repeat(1500));
    expect(input().props.value).toHaveLength(1000);
  });
});

describe('вложения в чате', () => {
  it('фото загружается и отправляется отдельным сообщением', async () => {
    const uploadAttachment = jest.fn(createMockApi({ delayMs: 0 }).uploadAttachment);
    const real = createMockApi({ delayMs: 0 });
    const sendMessage = jest.fn(async (id: string, body: SendMessageInput) => {
      const upload = await real.uploadAttachment({
        file: { uri: 'file:///cache/shot.jpg', name: 'shot.jpg', mimeType: 'image/jpeg' },
      });
      return real.sendMessage(id, { ...body, attachmentIds: [upload.id] });
    });
    setApi(api({ uploadAttachment, sendMessage }));
    await renderChat();

    await attachFromGallery([photo('shot.jpg')]);

    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    const body = sendMessage.mock.calls[0]?.[1];
    expect(body?.attachmentIds).toHaveLength(1);
    expect(screen.queryByTestId('attach-sheet')).not.toBeOnTheScreen();
  });

  it('несколько файлов — несколько сообщений', async () => {
    const sendMessage = jest.fn(createMockApi({ delayMs: 0 }).sendMessage);
    setApi(api({ sendMessage }));
    await renderChat();

    await attachFromGallery([photo('a.jpg'), photo('b.jpg')]);

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
  });

  it('пока файл отправляется, у сообщения «Отправляется…» и миниатюра', async () => {
    const uploadAttachment = jest.fn(() => new Promise<{ id: string }>(() => undefined));
    setApi(api({ uploadAttachment }));
    await renderChat();

    await attachFromGallery([photo('shot.jpg')]);

    expect(await screen.findByText('Отправляется…')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/-photo$/).length).toBeGreaterThan(1);
  });

  it('ошибка загрузки: «Не отправлено · Повторить» грузит файл заново', async () => {
    const real = createMockApi({ delayMs: 0 });
    const uploadAttachment = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(real.uploadAttachment);
    const sendMessage = jest.fn(real.sendMessage);
    setApi(api({ uploadAttachment, sendMessage }));
    await renderChat();
    await attachFromGallery([photo('shot.jpg')]);
    expect(await screen.findByText('Не отправлено · Повторить')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Не отправлено · Повторить'));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(uploadAttachment).toHaveBeenCalledTimes(2);
  });

  it('если файл уже загружен, а отправка не прошла, повтор не грузит его второй раз', async () => {
    const real = createMockApi({ delayMs: 0 });
    const uploadAttachment = jest.fn(real.uploadAttachment);
    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(real.sendMessage);
    setApi(api({ uploadAttachment, sendMessage }));
    await renderChat();
    await attachFromGallery([photo('shot.jpg')]);
    await screen.findByText('Не отправлено · Повторить');

    await fireEvent.press(screen.getByText('Не отправлено · Повторить'));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    const ids = sendMessage.mock.calls.map(([, body]) => (body as SendMessageInput).attachmentIds);
    expect(ids[1]).toEqual(ids[0]);
  });

  it('слишком большой файл не отправляется, причина названа', async () => {
    const sendMessage = jest.fn();
    setApi(api({ sendMessage }));
    await renderChat();

    await attachFromGallery([photo('big.jpg', 30 * MB)]);

    expect(await screen.findByText('big.jpg: файл больше 20 МБ')).toBeOnTheScreen();
    await flush();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('отказ в доступе к камере: сообщение и «Открыть настройки»', async () => {
    setApi(api());
    await renderChat();
    pickers({ takeMedia: jest.fn().mockResolvedValue({ status: 'denied', source: 'camera' }) });

    await fireEvent.press(screen.getByTestId('chat-attach'));
    await fireEvent.press(screen.getByTestId('attach-camera'));

    expect(
      await screen.findByText('Нет доступа к камере. Разрешите его в настройках телефона'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Открыть настройки')).toBeOnTheScreen();
  });

  it('закрыли выбор без файла — ничего не отправляется', async () => {
    const sendMessage = jest.fn();
    setApi(api({ sendMessage }));
    await renderChat();
    pickers({ pickFromGallery: jest.fn().mockResolvedValue({ status: 'cancelled' }) });

    await fireEvent.press(screen.getByTestId('chat-attach'));
    await fireEvent.press(screen.getByTestId('attach-gallery'));
    await flush();

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('скрепка открывает лист «Добавить вложение»', async () => {
    setApi(api());
    await renderChat();

    await fireEvent.press(screen.getByTestId('chat-attach'));

    expect(screen.getByText('Добавить вложение')).toBeOnTheScreen();
    expect(screen.getByText('Снять фото или видео')).toBeOnTheScreen();
  });
});

describe('обновление чата', () => {
  async function renderWithTimers(active: boolean, listMessages: ApiClient['listMessages']) {
    jest.useFakeTimers();
    setApi(api({ listMessages }));
    await renderWithProviders(<ChatTab requestId={REQUEST} active={active} />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
  }

  it('пока чат открыт, переписка обновляется раз в 5 секунд, новое сообщение появляется слева', async () => {
    const real = createMockApi({ delayMs: 0 }).listMessages;
    const incoming: ChatMessage = {
      id: 'server-new',
      author: { role: 'executor' },
      mine: false,
      text: 'Уже еду к вам',
      createdAt: '2026-11-22T11:00:00.000Z',
    };
    const listMessages = jest
      .fn<ReturnType<ApiClient['listMessages']>, [string]>()
      .mockImplementationOnce(real)
      .mockImplementation(async (id) => [...(await real(id)), incoming]);
    await renderWithTimers(true, listMessages);
    expect(listMessages).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
    });

    expect(listMessages.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Уже еду к вам')).toBeOnTheScreen();
  });

  it('когда чат закрыт (другая вкладка, ушли с экрана), опроса нет', async () => {
    const listMessages = jest.fn(createMockApi({ delayMs: 0 }).listMessages);
    await renderWithTimers(false, listMessages);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });

    expect(listMessages).toHaveBeenCalledTimes(1);
  });

  it('опрос не затирает и не дублирует сообщение жителя, пока оно отправляется', async () => {
    const real = createMockApi({ delayMs: 0 });
    jest.useFakeTimers();
    const sendMessage = jest.fn(() => new Promise<ChatMessage>(() => undefined));
    setApi(api({ sendMessage, listMessages: real.listMessages }));
    await renderWithProviders(<ChatTab requestId={REQUEST} active />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Ещё вопрос');
    await fireEvent.press(screen.getByTestId('chat-send'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    });

    expect(screen.getAllByText('Ещё вопрос')).toHaveLength(1);
    expect(screen.getByText('Отправляется…')).toBeOnTheScreen();
  });

  it('если опрос вернул уже подтверждённое сообщение жителя, оно показывается один раз', async () => {
    const real = createMockApi({ delayMs: 0 });
    jest.useFakeTimers();
    let key = '';
    const sendMessage = jest.fn((_id: string, body: SendMessageInput) => {
      key = body.clientMessageId;
      return new Promise<ChatMessage>(() => undefined);
    });
    const listMessages = jest.fn(async (id: string) => {
      const base = await real.listMessages(id);
      return key
        ? [
            ...base,
            {
              id: 'server-mine',
              clientMessageId: key,
              author: { role: 'resident' as const },
              mine: true,
              text: 'Дубль?',
              createdAt: '2026-11-22T11:00:00.000Z',
            },
          ]
        : base;
    });
    setApi(api({ sendMessage, listMessages }));
    await renderWithProviders(<ChatTab requestId={REQUEST} active />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Дубль?');
    await fireEvent.press(screen.getByTestId('chat-send'));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
    });

    expect(screen.getAllByText('Дубль?')).toHaveLength(1);
    expect(screen.queryByText('Отправляется…')).not.toBeOnTheScreen();
  });

  it('возврат в приложение сразу обновляет переписку', async () => {
    const listMessages = jest.fn(createMockApi({ delayMs: 0 }).listMessages);
    let onChange: ((state: string) => void) | undefined;
    const subscribe = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, handler) => {
        onChange = handler as (state: string) => void;
        return { remove: jest.fn() };
      });
    setApi(api({ listMessages }));
    await renderChat();
    expect(listMessages).toHaveBeenCalledTimes(1);

    await act(async () => onChange?.('active'));

    await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(2));
    subscribe.mockRestore();
  });
});
