import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';

import {
  ApiError,
  setApi,
  type ApiClient,
  type CreateRequestResult,
  type Residency,
  type UploadAttachmentInput,
} from '@/api';
import { createMockApi } from '@/api/mockApi';
import { renderWithProviders } from '@/test/utils';

import { useCreatedRequest } from '../createdRequestStore';
import { useRequestDraft, type Attachment } from '../draftStore';
import { NewRequestScreen } from '../NewRequestScreen';
import { setPickers, type PickedFile, type Pickers } from '../pickers';
import { discardDraft } from '../uploader';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  Redirect: jest.fn(() => null),
  useLocalSearchParams: jest.fn(() => ({})),
  usePreventRemove: jest.fn(() => jest.fn()),
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openSettings: jest.fn(),
  openURL: jest.fn(),
}));

const MB = 1024 * 1024;
const HEATING_TEXT = 'Нет отопления во всей квартире с утра';

const primary: Residency = {
  id: 'residency-1',
  houseId: 'house-1',
  address: 'г. Оренбург, ул. Тестовая, д. 1',
  apartment: '12',
  status: 'confirmed',
  primary: true,
};
const other: Residency = {
  id: 'residency-2',
  houseId: 'house-2',
  address: 'г. Оренбург, ул. Образцовая, д. 12',
  apartment: '7',
  status: 'confirmed',
  primary: false,
};
const pendingResidency: Residency = { ...other, id: 'residency-3', status: 'pending' };

const created: CreateRequestResult = {
  id: 'request-1',
  number: 1001,
  createdAt: '2026-11-22T10:00:00.000Z',
  status: 'new',
  answerWithinMin: 15,
};

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    ...createMockApi({ delayMs: 0 }),
    getResidencies: jest.fn().mockResolvedValue([primary]),
    createRequest: jest.fn().mockResolvedValue(created),
    ...overrides,
  };
}

type Job = {
  input: UploadAttachmentInput;
  resolve: (id: string) => void;
  reject: (e: unknown) => void;
};

/** Загрузка под управлением теста: завершает и отклоняет по команде, слушает отмену. */
function controlledUploads() {
  const jobs: Job[] = [];
  const uploadAttachment: ApiClient['uploadAttachment'] = (input) =>
    new Promise((resolve, reject) => {
      jobs.push({ input, resolve: (id) => resolve({ id }), reject });
      input.signal?.addEventListener('abort', () => reject(new ApiError('aborted')));
    });
  return { jobs, uploadAttachment };
}

function pickers(overrides: Partial<Pickers> = {}) {
  const value: Pickers = {
    takeMedia: jest.fn(),
    pickFromGallery: jest.fn(),
    pickDocument: jest.fn(),
    fileExists: () => true,
    ...overrides,
  };
  setPickers(value);
  return value;
}

const photo = (name: string, size = MB): PickedFile => ({
  uri: `file:///${name}`,
  name,
  size,
  kind: 'image',
});

function attachment(index: number, patch: Partial<Attachment> = {}): Attachment {
  return {
    localId: `att-${index}`,
    uri: `file:///f${index}.jpg`,
    name: `f${index}.jpg`,
    size: MB,
    kind: 'image',
    status: 'uploaded',
    progress: 1,
    remoteId: `remote-${index}`,
    ...patch,
  };
}

const submit = () => screen.getByTestId('request-submit');
const description = () => screen.getByTestId('request-description');
const disablePrevention = jest.fn();
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fillValid() {
  useRequestDraft.setState({
    category: { id: 'heating', name: 'Отопление' },
    description: HEATING_TEXT,
  });
}

function preventArgs() {
  const calls = jest.mocked(usePreventRemove).mock.calls;
  const last = calls[calls.length - 1];
  return { prevent: last?.[0], callback: last?.[1] };
}

async function openAttachSheet() {
  await fireEvent.press(screen.getByTestId('attach-photo'));
}

async function pickGallery(files: PickedFile[]) {
  const p = pickers({
    pickFromGallery: jest.fn().mockResolvedValue({ status: 'picked', files }),
  });
  await openAttachSheet();
  await fireEvent.press(screen.getByTestId('attach-gallery'));
  return p;
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  jest.mocked(usePreventRemove).mockReturnValue(disablePrevention);
  discardDraft();
  useCreatedRequest.getState().setSummary(null);
  await flush();
  pickers();
});

afterEach(async () => {
  discardDraft();
  await flush();
  setPickers(null);
});

describe('S12: выбор категории', () => {
  it('лист показывает категории из API, выбор ставит категорию и закрывает лист', async () => {
    setApi(fakeApi());
    await renderWithProviders(<NewRequestScreen />);

    await fireEvent.press(screen.getByTestId('request-category'));

    for (const name of [
      'Протечка',
      'Отопление',
      'Лифт',
      'Электрика',
      'Сантехника',
      'Домофон',
      'Другое',
    ]) {
      expect(await screen.findByText(name)).toBeOnTheScreen();
    }
    await fireEvent.press(screen.getByTestId('category-option-elevator'));

    expect(useRequestDraft.getState().category).toEqual({ id: 'elevator', name: 'Лифт' });
    expect(screen.queryByTestId('category-sheet')).not.toBeOnTheScreen();
    expect(screen.getByText('Лифт')).toBeOnTheScreen();
  });

  it('выбранная категория отмечена в списке', async () => {
    setApi(fakeApi());
    useRequestDraft.setState({ category: { id: 'heating', name: 'Отопление' } });
    await renderWithProviders(<NewRequestScreen />);

    await fireEvent.press(screen.getByTestId('request-category'));
    await screen.findByTestId('category-option-heating');

    expect(screen.getByTestId('category-option-heating')).toBeSelected();
    expect(screen.getByTestId('category-option-elevator')).not.toBeSelected();
  });

  it('поиск оставляет подходящие категории без учёта регистра, пустой результат объясняется', async () => {
    setApi(fakeApi());
    await renderWithProviders(<NewRequestScreen />);
    await fireEvent.press(screen.getByTestId('request-category'));
    await screen.findByTestId('category-option-heating');

    await fireEvent.changeText(screen.getByTestId('category-search'), 'ТОП');
    expect(screen.getByTestId('category-option-heating')).toBeOnTheScreen();
    expect(screen.queryByTestId('category-option-elevator')).not.toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('category-search'), 'ящерица');
    expect(screen.getByTestId('category-empty')).toHaveTextContent(
      'Такой категории нет. Выберите «Другое»',
    );
  });

  it('ошибка загрузки категорий: сообщение и «Повторить»', async () => {
    const getCategories = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue([{ id: 'other', name: 'Другое' }]);
    setApi(fakeApi({ getCategories }));
    await renderWithProviders(<NewRequestScreen />);

    await fireEvent.press(screen.getByTestId('request-category'));
    expect(await screen.findByText('Не удалось загрузить категории')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('category-retry'));
    expect(await screen.findByTestId('category-option-other')).toBeOnTheScreen();
  });

  it('ручной выбор убирает ошибку поля после неудачной отправки', async () => {
    setApi(fakeApi());
    useRequestDraft.setState({ description: HEATING_TEXT });
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');

    await fireEvent.press(submit());
    expect(screen.getByTestId('request-category-error')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('request-category'));
    await fireEvent.press(await screen.findByTestId('category-option-heating'));

    expect(screen.queryByTestId('request-category-error')).not.toBeOnTheScreen();
  });
});

describe('S5: выбор адреса', () => {
  it('в листе подтверждённые привязки с подписями, неподтверждённых нет', async () => {
    setApi(
      fakeApi({ getResidencies: jest.fn().mockResolvedValue([primary, other, pendingResidency]) }),
    );
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');

    await fireEvent.press(screen.getByTestId('request-address'));

    expect(screen.getByTestId('address-option-residency-1')).toBeSelected();
    expect(screen.getByText('Основной адрес')).toBeOnTheScreen();
    expect(screen.getByText('Добавлен жителем')).toBeOnTheScreen();
    expect(screen.queryByTestId('address-option-residency-3')).not.toBeOnTheScreen();
  });

  it('выбранный адрес уходит в заявку, основной адрес не меняется', async () => {
    const createRequest = jest.fn().mockResolvedValue(created);
    setApi(
      fakeApi({ getResidencies: jest.fn().mockResolvedValue([primary, other]), createRequest }),
    );
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');

    await fireEvent.press(screen.getByTestId('request-address'));
    await fireEvent.press(screen.getByTestId('address-option-residency-2'));

    expect(screen.getByText('г. Оренбург, ул. Образцовая, д. 12, кв. 7')).toBeOnTheScreen();
    await fireEvent.press(submit());

    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ residencyId: 'residency-2' }),
      ),
    );
  });

  it('новая заявка начинается с основного адреса, даже если раньше выбирали другой для прошлой', async () => {
    setApi(fakeApi({ getResidencies: jest.fn().mockResolvedValue([other, primary]) }));
    await renderWithProviders(<NewRequestScreen />);
    expect(await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12')).toBeOnTheScreen();
  });

  it('«Добавить адрес» ведёт в онбординг и не трогает черновик', async () => {
    setApi(fakeApi());
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');

    await fireEvent.press(screen.getByTestId('request-address'));
    await fireEvent.press(screen.getByTestId('address-add'));

    expect(router.push).toHaveBeenCalledWith('/choose-home');
    expect(useRequestDraft.getState().description).toBe(HEATING_TEXT);
  });
});

describe('S6, S7a: добавление вложений', () => {
  it('без файлов: подсказка с лимитами и «0 файлов», подпись «Можно отправить без вложений»', async () => {
    setApi(fakeApi());
    fillValid();
    await renderWithProviders(<NewRequestScreen />);

    expect(screen.getByTestId('attachments-counter')).toHaveTextContent('До 10 файлов');
    expect(screen.getByTestId('attachments-empty-hint')).toHaveTextContent(
      'Фото и видео до 100 МБ, документы PDF и DOC до 20 МБ. Вложения необязательны.',
    );
    expect(screen.getByTestId('request-caption')).toHaveTextContent(
      'Можно отправить без вложений.',
    );
  });

  it.each(['attach-photo', 'attach-video', 'attach-file'])(
    'кнопка %s открывает лист из трёх действий',
    async (id) => {
      setApi(fakeApi());
      await renderWithProviders(<NewRequestScreen />);

      await fireEvent.press(screen.getByTestId(id));

      expect(screen.getByText('Добавить вложение')).toBeOnTheScreen();
      expect(screen.getByText('Снять фото или видео')).toBeOnTheScreen();
      expect(screen.getByText('До 10 файлов, видео до 100 МБ')).toBeOnTheScreen();
      expect(screen.getByText('PDF, DOC, до 20 МБ')).toBeOnTheScreen();
    },
  );

  it('из галереи: файлы появляются в списке и загружаются, счётчик растёт', async () => {
    setApi(fakeApi());
    fillValid();
    await renderWithProviders(<NewRequestScreen />);

    await pickGallery([photo('one.jpg', 1.2 * MB), photo('two.jpg', 2 * MB)]);

    expect(await screen.findByText('one.jpg')).toBeOnTheScreen();
    expect(screen.getByText('two.jpg')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getAllByText(/МБ · загружено/)).toHaveLength(2));
    expect(screen.getByText('1,2 МБ · загружено')).toBeOnTheScreen();
    expect(screen.getByTestId('attachments-counter')).toHaveTextContent('2 из 10');
    expect(screen.getByTestId('request-caption')).toHaveTextContent(
      'Заявку получит диспетчер. Статус придёт в MAX и push.',
    );
    expect(submit()).toBeEnabled();
  });

  it('лист закрывается после выбора действия', async () => {
    setApi(fakeApi());
    await renderWithProviders(<NewRequestScreen />);
    await pickGallery([photo('one.jpg')]);
    expect(screen.queryByTestId('attach-sheet')).not.toBeOnTheScreen();
  });

  it('камера: снятый файл добавляется', async () => {
    setApi(fakeApi());
    await renderWithProviders(<NewRequestScreen />);
    const p = pickers({
      takeMedia: jest.fn().mockResolvedValue({ status: 'picked', files: [photo('shot.jpg')] }),
    });

    await openAttachSheet();
    await fireEvent.press(screen.getByTestId('attach-camera'));

    expect(p.takeMedia).toHaveBeenCalledWith('any');
    expect(await screen.findByText('shot.jpg')).toBeOnTheScreen();
  });

  it('документ: выбор PDF добавляет файл', async () => {
    setApi(fakeApi());
    await renderWithProviders(<NewRequestScreen />);
    pickers({
      pickDocument: jest.fn().mockResolvedValue({
        status: 'picked',
        files: [
          {
            uri: 'file:///act.pdf',
            name: 'act.pdf',
            size: MB,
            mimeType: 'application/pdf',
            kind: 'document',
          },
        ],
      }),
    });

    await openAttachSheet();
    await fireEvent.press(screen.getByTestId('attach-document'));

    expect(await screen.findByText('act.pdf')).toBeOnTheScreen();
  });

  it('закрыли системный выбор без файла — ничего не меняется', async () => {
    setApi(fakeApi());
    await renderWithProviders(<NewRequestScreen />);
    pickers({ pickFromGallery: jest.fn().mockResolvedValue({ status: 'cancelled' }) });

    await openAttachSheet();
    await fireEvent.press(screen.getByTestId('attach-gallery'));

    expect(useRequestDraft.getState().attachments).toHaveLength(0);
    expect(screen.queryByTestId('attachments-message')).not.toBeOnTheScreen();
  });

  it('отказ в доступе к камере: сообщение и «Открыть настройки»', async () => {
    setApi(fakeApi());
    await renderWithProviders(<NewRequestScreen />);
    pickers({ takeMedia: jest.fn().mockResolvedValue({ status: 'denied', source: 'camera' }) });

    await openAttachSheet();
    await fireEvent.press(screen.getByTestId('attach-camera'));

    expect(
      await screen.findByText('Нет доступа к камере. Разрешите его в настройках телефона'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Открыть настройки')).toBeOnTheScreen();
  });

  it('отказ в доступе к фото: своё сообщение', async () => {
    setApi(fakeApi());
    await renderWithProviders(<NewRequestScreen />);
    pickers({
      pickFromGallery: jest.fn().mockResolvedValue({ status: 'denied', source: 'library' }),
    });

    await openAttachSheet();
    await fireEvent.press(screen.getByTestId('attach-gallery'));

    expect(
      await screen.findByText('Нет доступа к фото. Разрешите его в настройках телефона'),
    ).toBeOnTheScreen();
  });

  it('системная ошибка выбора показывается сообщением, а не падением', async () => {
    setApi(fakeApi());
    await renderWithProviders(<NewRequestScreen />);
    pickers({ pickFromGallery: jest.fn().mockRejectedValue(new Error('boom')) });

    await openAttachSheet();
    await fireEvent.press(screen.getByTestId('attach-gallery'));

    expect(
      await screen.findByText('Не удалось выбрать файл. Попробуйте ещё раз'),
    ).toBeOnTheScreen();
  });

  it('слишком большой файл не добавляется, причина названа', async () => {
    setApi(fakeApi());
    await renderWithProviders(<NewRequestScreen />);

    await pickGallery([photo('big.jpg', 30 * MB), photo('ok.jpg')]);

    expect(await screen.findByText('big.jpg: файл больше 20 МБ')).toBeOnTheScreen();
    expect(screen.getByText('ok.jpg')).toBeOnTheScreen();
    expect(screen.queryByText('big.jpg')).not.toBeOnTheScreen();
  });

  it('при 8 файлах и 5 выбранных добавляются два', async () => {
    setApi(fakeApi());
    useRequestDraft.setState({
      attachments: Array.from({ length: 8 }, (_, index) => attachment(index)),
    });
    await renderWithProviders(<NewRequestScreen />);

    await pickGallery(['a', 'b', 'c', 'd', 'e'].map((name) => photo(`${name}.jpg`)));

    expect(await screen.findByText('Добавлено 2 из 5: максимум 10 вложений')).toBeOnTheScreen();
    expect(useRequestDraft.getState().attachments).toHaveLength(10);
  });
});

describe('S7b–S7f: состояния вложений', () => {
  it('S7b: идёт загрузка — процент, «Отменить загрузку», кнопка неактивна, подпись про ожидание', async () => {
    const { jobs, uploadAttachment } = controlledUploads();
    setApi(fakeApi({ uploadAttachment }));
    fillValid();
    await renderWithProviders(<NewRequestScreen />);

    await pickGallery([photo('one.jpg')]);
    await screen.findByText('one.jpg');
    await act(async () => jobs[0]?.input.onProgress?.(0.35));

    const localId = useRequestDraft.getState().attachments[0]?.localId ?? '';
    expect(screen.getByTestId(`attachment-${localId}-percent`)).toHaveTextContent('35%');
    expect(screen.getByRole('button', { name: 'Отменить загрузку' })).toBeOnTheScreen();
    expect(submit()).toBeDisabled();
    expect(screen.getByTestId('request-caption')).toHaveTextContent(
      'Дождитесь окончания загрузки вложений.',
    );
    expect(screen.getByTestId('attachments-counter')).toHaveTextContent('1 из 10');
  });

  it('S7b: «Отменить загрузку» прерывает её и убирает файл', async () => {
    const { jobs, uploadAttachment } = controlledUploads();
    setApi(fakeApi({ uploadAttachment }));
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await pickGallery([photo('one.jpg')]);
    await screen.findByText('one.jpg');

    await fireEvent.press(screen.getByRole('button', { name: 'Отменить загрузку' }));
    await flush();

    expect(jobs[0]?.input.signal?.aborted).toBe(true);
    expect(screen.queryByText('one.jpg')).not.toBeOnTheScreen();
    expect(submit()).toBeEnabled();
  });

  it('S7c: часть не загрузилась — плашка, «Повторить» на строке, «Повторить все», кнопка неактивна', async () => {
    const { jobs, uploadAttachment } = controlledUploads();
    setApi(fakeApi({ uploadAttachment }));
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await pickGallery([photo('a.jpg'), photo('b.jpg'), photo('c.jpg')]);
    await screen.findByText('c.jpg');

    await act(async () => {
      jobs[0]?.resolve('remote-a');
      jobs[1]?.reject(new ApiError('network'));
      jobs[2]?.reject(new ApiError('network'));
    });

    expect(screen.getByText('Не загрузилось: 2 файла. Нет связи.')).toBeOnTheScreen();
    expect(screen.getAllByText('Не загрузилось · нет связи')).toHaveLength(2);
    expect(submit()).toBeDisabled();
    expect(screen.getByTestId('request-caption')).toHaveTextContent(
      'Повторите загрузку или удалите файлы с ошибкой.',
    );

    await fireEvent.press(screen.getByTestId('attachments-notice-action'));
    await flush();
    expect(jobs).toHaveLength(5);
    expect(screen.queryByTestId('attachments-notice')).not.toBeOnTheScreen();
  });

  it('S7c: «Повторить» на строке перезапускает один файл, после успеха кнопка снова активна', async () => {
    const { jobs, uploadAttachment } = controlledUploads();
    setApi(fakeApi({ uploadAttachment }));
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await pickGallery([photo('a.jpg')]);
    await screen.findByText('a.jpg');
    await act(async () => jobs[0]?.reject(new ApiError('network')));
    expect(screen.getByText('Не загрузилось: 1 файл. Нет связи.')).toBeOnTheScreen();

    const localId = useRequestDraft.getState().attachments[0]?.localId ?? '';
    await fireEvent.press(screen.getByTestId(`attachment-${localId}-retry`));
    await flush();
    expect(jobs).toHaveLength(2);
    await act(async () => jobs[1]?.resolve('remote-a'));

    expect(screen.queryByTestId('attachments-notice')).not.toBeOnTheScreen();
    expect(submit()).toBeEnabled();
  });

  it('S7c: удаление файла с ошибкой пересчитывает плашку', async () => {
    const { jobs, uploadAttachment } = controlledUploads();
    setApi(fakeApi({ uploadAttachment }));
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await pickGallery([photo('a.jpg'), photo('b.jpg')]);
    await screen.findByText('b.jpg');
    await act(async () => {
      jobs[0]?.reject(new ApiError('network'));
      jobs[1]?.reject(new ApiError('network'));
    });
    expect(screen.getByText('Не загрузилось: 2 файла. Нет связи.')).toBeOnTheScreen();

    const first = useRequestDraft.getState().attachments[0]?.localId ?? '';
    await fireEvent.press(screen.getByTestId(`attachment-${first}-remove`));

    expect(screen.getByText('Не загрузилось: 1 файл. Нет связи.')).toBeOnTheScreen();
  });

  it('S7c: файл пропал с устройства — «Файл больше недоступен»', async () => {
    const { jobs, uploadAttachment } = controlledUploads();
    setApi(fakeApi({ uploadAttachment }));
    useRequestDraft.setState({
      attachments: [
        attachment(1, { status: 'failed', progress: 0, error: 'network', remoteId: undefined }),
      ],
    });
    pickers({ fileExists: () => false });
    await renderWithProviders(<NewRequestScreen />);

    await fireEvent.press(screen.getByTestId('attachment-att-1-retry'));

    expect(await screen.findByText('Файл больше недоступен')).toBeOnTheScreen();
    expect(jobs).toHaveLength(0);
  });

  it('S7d: всё загружено — «N из 10», кнопка активна, подпись стандартная', async () => {
    setApi(fakeApi());
    fillValid();
    useRequestDraft.setState({
      attachments: [attachment(1), attachment(2), attachment(3), attachment(4)],
    });
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');

    expect(screen.getByTestId('attachments-counter')).toHaveTextContent('4 из 10');
    expect(submit()).toBeEnabled();
    expect(screen.getByTestId('request-caption')).toHaveTextContent(
      'Заявку получит диспетчер. Статус придёт в MAX и push.',
    );
  });

  it('S7e: много файлов — все рядами в одном списке', async () => {
    setApi(fakeApi());
    fillValid();
    useRequestDraft.setState({
      attachments: Array.from({ length: 8 }, (_, index) => attachment(index)),
    });
    await renderWithProviders(<NewRequestScreen />);

    expect(screen.getByTestId('attachments-counter')).toHaveTextContent('8 из 10');
    for (let index = 0; index < 8; index += 1) {
      expect(screen.getByText(`f${index}.jpg`)).toBeOnTheScreen();
    }
  });

  it('S7f: лимит — «Максимум 10», кнопки неактивны, подсказка; после удаления кнопки снова активны', async () => {
    setApi(fakeApi());
    fillValid();
    useRequestDraft.setState({
      attachments: Array.from({ length: 10 }, (_, index) => attachment(index)),
    });
    await renderWithProviders(<NewRequestScreen />);

    expect(screen.getByTestId('attachments-counter')).toHaveTextContent('Максимум 10');
    expect(screen.getByTestId('attachments-limit-hint')).toHaveTextContent(
      'Чтобы добавить новое, удалите одно из вложений.',
    );
    expect(screen.getByTestId('attach-photo')).toBeDisabled();
    expect(screen.getByTestId('attach-video')).toBeDisabled();
    expect(screen.getByTestId('attach-file')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('attachment-att-3-remove'));

    expect(screen.getByTestId('attachments-counter')).toHaveTextContent('9 из 10');
    expect(screen.getByTestId('attach-photo')).toBeEnabled();
  });
});

describe('S8–S10: отправка', () => {
  it('в заявку уходят идентификаторы загруженных файлов, после успеха черновик пуст и открыт экран успеха', async () => {
    const createRequest = jest.fn().mockResolvedValue(created);
    setApi(fakeApi({ createRequest }));
    fillValid();
    useRequestDraft.setState({ attachments: [attachment(1), attachment(2)] });
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');

    await fireEvent.press(submit());

    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith({
        categoryId: 'heating',
        description: HEATING_TEXT,
        residencyId: 'residency-1',
        attachmentIds: ['remote-1', 'remote-2'],
      }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/requests/sent'));
    expect(useRequestDraft.getState()).toMatchObject({
      category: null,
      description: '',
      attachments: [],
    });
    expect(useCreatedRequest.getState().summary).toMatchObject({
      number: 1001,
      categoryName: 'Отопление',
      address: 'г. Оренбург, ул. Тестовая, д. 1, кв. 12',
      answerWithinMin: 15,
    });
  });

  it('S8: во время отправки кнопка «Отправляем…», поля и вложения заблокированы', async () => {
    const createRequest = jest.fn(() => new Promise<CreateRequestResult>(() => undefined));
    setApi(fakeApi({ createRequest }));
    fillValid();
    useRequestDraft.setState({ attachments: [attachment(1)] });
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');

    await fireEvent.press(submit());

    expect(await screen.findByText('Отправляем…')).toBeOnTheScreen();
    expect(submit()).toBeDisabled();
    expect(description()).toHaveProp('editable', false);
    expect(screen.getByTestId('attach-photo')).toBeDisabled();
    expect(screen.getByTestId('attachment-att-1-remove')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('request-category'));
    expect(screen.queryByTestId('category-sheet')).not.toBeOnTheScreen();
  });

  it('во время отправки выход не открывает лист черновика', async () => {
    const createRequest = jest.fn(() => new Promise<CreateRequestResult>(() => undefined));
    setApi(fakeApi({ createRequest }));
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');
    await fireEvent.press(submit());
    await screen.findByText('Отправляем…');

    await act(async () =>
      preventArgs().callback?.({
        data: { action: { type: 'GO_BACK' } },
        repeat: jest.fn(),
      } as never),
    );

    expect(screen.queryByTestId('discard-sheet')).not.toBeOnTheScreen();
  });

  it('S10: «rejected» при отказе сервера, черновик остаётся', async () => {
    const createRequest = jest.fn().mockRejectedValue(new ApiError('validation'));
    setApi(fakeApi({ createRequest }));
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');

    await fireEvent.press(submit());

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/requests/failed',
        params: { reason: 'rejected' },
      }),
    );
    expect(useRequestDraft.getState().description).toBe(HEATING_TEXT);
  });

  it('после «Повторить» с экрана ошибки форма сама отправляет заявку один раз', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ retry: '1' });
    const createRequest = jest.fn().mockResolvedValue(created);
    setApi(fakeApi({ createRequest }));
    fillValid();
    await renderWithProviders(<NewRequestScreen />);

    await waitFor(() => expect(createRequest).toHaveBeenCalledTimes(1));
    await flush();
    expect(createRequest).toHaveBeenCalledTimes(1);
  });

  it('автоповтор ждёт окончания загрузки файлов', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ retry: '1' });
    const createRequest = jest.fn().mockResolvedValue(created);
    setApi(fakeApi({ createRequest }));
    fillValid();
    useRequestDraft.setState({
      attachments: [
        attachment(1, { status: 'failed', progress: 0, error: 'network', remoteId: undefined }),
      ],
    });
    await renderWithProviders(<NewRequestScreen />);
    await flush();

    expect(createRequest).not.toHaveBeenCalled();
  });
});

describe('S11: выход с несохранёнными данными', () => {
  it('для пустой формы выход не перехватывается, для заполненной — перехватывается', async () => {
    setApi(fakeApi());
    await renderWithProviders(<NewRequestScreen />);
    expect(preventArgs().prevent).toBe(false);

    await fireEvent.changeText(description(), 'Холодно');
    expect(preventArgs().prevent).toBe(true);
  });

  it('вложение само по себе делает форму «грязной»', async () => {
    setApi(fakeApi());
    useRequestDraft.setState({ attachments: [attachment(1)] });
    await renderWithProviders(<NewRequestScreen />);
    expect(preventArgs().prevent).toBe(true);
  });

  async function triggerLeave() {
    await act(async () =>
      preventArgs().callback?.({
        data: { action: { type: 'GO_BACK' } },
        repeat: jest.fn(),
      } as never),
    );
  }

  it('при попытке выйти открывается лист с тремя действиями', async () => {
    setApi(fakeApi());
    fillValid();
    await renderWithProviders(<NewRequestScreen />);

    await triggerLeave();

    expect(screen.getByText('Сохранить черновик?')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Вы заполнили заявку, но не отправили её. Черновик сохранится в разделе «Заявки».',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('discard-save')).toBeOnTheScreen();
    expect(screen.getByTestId('discard-delete')).toBeOnTheScreen();
    expect(screen.getByTestId('discard-continue')).toBeOnTheScreen();
  });

  it('«Сохранить черновик» оставляет данные и закрывает форму', async () => {
    setApi(fakeApi());
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await triggerLeave();

    await fireEvent.press(screen.getByTestId('discard-save'));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(useRequestDraft.getState().description).toBe(HEATING_TEXT);
    expect(disablePrevention).toHaveBeenCalled();
  });

  it('«Удалить» стирает черновик вместе с вложениями и отменяет загрузки', async () => {
    const { jobs, uploadAttachment } = controlledUploads();
    setApi(fakeApi({ uploadAttachment }));
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await pickGallery([photo('a.jpg')]);
    await screen.findByText('a.jpg');
    await triggerLeave();

    await fireEvent.press(screen.getByTestId('discard-delete'));
    await flush();

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(useRequestDraft.getState()).toMatchObject({
      category: null,
      description: '',
      attachments: [],
    });
    expect(jobs[0]?.input.signal?.aborted).toBe(true);
  });

  it('«Продолжить редактирование» закрывает лист, форма остаётся', async () => {
    setApi(fakeApi());
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await triggerLeave();

    await fireEvent.press(screen.getByTestId('discard-continue'));

    expect(screen.queryByTestId('discard-sheet')).not.toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    expect(useRequestDraft.getState().description).toBe(HEATING_TEXT);
  });

  it('черновик восстанавливается при повторном открытии формы', async () => {
    setApi(fakeApi());
    useRequestDraft.setState({
      category: { id: 'leak', name: 'Протечка' },
      description: 'Течёт кран на кухне',
      attachments: [attachment(1)],
    });

    await renderWithProviders(<NewRequestScreen />);

    expect(screen.getByText('Протечка')).toBeOnTheScreen();
    expect(description()).toHaveDisplayValue('Течёт кран на кухне');
    expect(screen.getByText('f1.jpg')).toBeOnTheScreen();
  });
});
