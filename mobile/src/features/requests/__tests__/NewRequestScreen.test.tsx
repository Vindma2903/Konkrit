import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError, setApi, type ApiClient, type CreateRequestResult, type Residency } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { useSessionStore } from '@/features/auth/sessionStore';
import { renderWithProviders } from '@/test/utils';

import { useRequestDraft } from '../draftStore';
import { NewRequestScreen } from '../NewRequestScreen';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

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

const residency: Residency = {
  id: 'residency-1',
  houseId: 'house-1',
  address: 'г. Оренбург, ул. Тестовая, д. 1',
  apartment: '12',
  status: 'confirmed',
  primary: true,
};

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    ...createMockApi({ delayMs: 0 }),
    getResidencies: jest.fn().mockResolvedValue([residency]),
    ...overrides,
  };
}

const submit = () => screen.getByTestId('request-submit');
const description = () => screen.getByTestId('request-description');
const HEATING_TEXT = 'Нет отопления во всей квартире с утра';

async function type(text: string) {
  await fireEvent.changeText(description(), text);
}

describe('NewRequestScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({
      tokens: { accessToken: 'a', refreshToken: 'r' },
      user: { id: 'user-1' },
      hasResidency: true,
    });

    useRequestDraft.getState().reset();
  });

  describe('S1 — пустая форма', () => {
    it('кнопка неактивна, счётчик 0/500, ошибок нет, адрес из привязки', async () => {
      setApi(fakeApi());
      await renderWithProviders(<NewRequestScreen />);

      expect(submit()).toBeDisabled();
      expect(screen.getByText('0/500')).toBeOnTheScreen();
      expect(screen.getByText('Выберите категорию')).toBeOnTheScreen();
      expect(description()).toHaveProp('placeholder', 'Опишите проблему');
      expect(await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12')).toBeOnTheScreen();
      expect(screen.getByText('До 10 файлов')).toBeOnTheScreen();
      expect(
        screen.getByText('Заявку получит диспетчер. Статус придёт в MAX и push.'),
      ).toBeOnTheScreen();
      expect(screen.queryByTestId('category-suggestion')).not.toBeOnTheScreen();
    });
  });

  describe('S2 — ввод и подсказка категории', () => {
    it('счётчик растёт, подсказка появляется после паузы, «Выбрать» ставит категорию', async () => {
      setApi(fakeApi());
      await renderWithProviders(<NewRequestScreen />);

      await type(HEATING_TEXT);
      expect(screen.getByText(`${HEATING_TEXT.length}/500`)).toBeOnTheScreen();
      // Сразу после ввода подсказки ещё нет: ждём паузу в наборе.
      expect(screen.queryByTestId('category-suggestion')).not.toBeOnTheScreen();

      expect(
        await screen.findByText('Похоже на «Отопление»', {}, { timeout: 3000 }),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('category-suggestion-choose'));

      expect(screen.queryByTestId('category-suggestion')).not.toBeOnTheScreen();
      expect(screen.getByText('Отопление')).toBeOnTheScreen();
      expect(useRequestDraft.getState().category?.id).toBe('heating');
    });

    it('короткий текст не вызывает подсказку', async () => {
      const suggestCategory = jest.fn().mockResolvedValue(null);
      setApi(fakeApi({ suggestCategory }));
      await renderWithProviders(<NewRequestScreen />);

      await type('Холодно');
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(suggestCategory).not.toHaveBeenCalled();
    });

    it('если категория не подобрана — плашки нет и ошибки не показываются', async () => {
      const suggestCategory = jest.fn().mockResolvedValue(null);
      setApi(fakeApi({ suggestCategory }));
      await renderWithProviders(<NewRequestScreen />);

      await type('Хочу узнать расписание приёма');
      await waitFor(() => expect(suggestCategory).toHaveBeenCalledTimes(1), { timeout: 3000 });
      expect(screen.queryByTestId('category-suggestion')).not.toBeOnTheScreen();
      expect(screen.queryByTestId('request-description-error')).not.toBeOnTheScreen();
    });

    it('ошибка запроса подсказки молча игнорируется', async () => {
      const suggestCategory = jest.fn().mockRejectedValue(new Error('network'));
      setApi(fakeApi({ suggestCategory }));
      await renderWithProviders(<NewRequestScreen />);

      await type(HEATING_TEXT);
      await waitFor(() => expect(suggestCategory).toHaveBeenCalled(), { timeout: 3000 });
      expect(screen.queryByTestId('category-suggestion')).not.toBeOnTheScreen();
      expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    });

    it('если категория уже выбрана, подсказку не запрашивают', async () => {
      const suggestCategory = jest.fn().mockResolvedValue(null);
      setApi(fakeApi({ suggestCategory }));
      useRequestDraft.getState().setCategory({ id: 'heating', name: 'Отопление' });
      await renderWithProviders(<NewRequestScreen />);

      await type(HEATING_TEXT);
      await new Promise((resolve) => setTimeout(resolve, 700));
      expect(suggestCategory).not.toHaveBeenCalled();
    });

    it('вставка длиннее лимита обрезается до 500 символов', async () => {
      setApi(fakeApi());
      await renderWithProviders(<NewRequestScreen />);

      await type('а'.repeat(800));
      expect(screen.getByText('500/500')).toBeOnTheScreen();
      expect(description().props.value).toHaveLength(500);
    });
  });

  describe('S3 — заполнено', () => {
    it('с категорией и описанием кнопка активна, ошибок нет', async () => {
      setApi(fakeApi());
      useRequestDraft.getState().setCategory({ id: 'heating', name: 'Отопление' });
      await renderWithProviders(<NewRequestScreen />);

      await type('Нет отопления во всей квартире с утра. Батареи холодные.');
      expect(screen.getByText('56/500')).toBeOnTheScreen();
      expect(submit()).toBeEnabled();
      expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    });
  });

  describe('S4 — ошибки валидации', () => {
    it('отправка с пустой категорией и коротким описанием показывает обе ошибки и не шлёт запрос', async () => {
      const createRequest = jest.fn();
      setApi(fakeApi({ createRequest }));
      await renderWithProviders(<NewRequestScreen />);

      await type('Холодно');
      expect(submit()).toBeEnabled();
      expect(screen.queryByRole('alert')).not.toBeOnTheScreen();

      await fireEvent.press(submit());

      expect(screen.getAllByText('Выберите категорию').length).toBeGreaterThan(1);
      expect(screen.getByText('Опишите подробнее: минимум 10 символов')).toBeOnTheScreen();
      expect(createRequest).not.toHaveBeenCalled();
    });

    it('ошибка поля исчезает сразу после исправления, без повторной отправки', async () => {
      setApi(fakeApi());
      await renderWithProviders(<NewRequestScreen />);

      await type('Холодно');
      await fireEvent.press(submit());
      expect(screen.getByText('Опишите подробнее: минимум 10 символов')).toBeOnTheScreen();

      await type(HEATING_TEXT);
      expect(screen.queryByText('Опишите подробнее: минимум 10 символов')).not.toBeOnTheScreen();
      // Категория по-прежнему не выбрана — её ошибка остаётся.
      expect(screen.getByTestId('request-category-error')).toBeOnTheScreen();

      await fireEvent.press(
        await screen.findByTestId('category-suggestion-choose', {}, { timeout: 3000 }),
      );
      expect(screen.queryByTestId('request-category-error')).not.toBeOnTheScreen();
    });

    it('описание из одних пробелов считается пустым', async () => {
      setApi(fakeApi());
      useRequestDraft.getState().setCategory({ id: 'heating', name: 'Отопление' });
      await renderWithProviders(<NewRequestScreen />);

      await type(' '.repeat(20));
      await fireEvent.press(submit());
      expect(screen.getByText('Опишите подробнее: минимум 10 символов')).toBeOnTheScreen();
    });

    it('без привязанной квартиры показывает ошибку у адреса и не отправляет', async () => {
      const createRequest = jest.fn();
      setApi(fakeApi({ getResidencies: jest.fn().mockResolvedValue([]), createRequest }));
      useRequestDraft.getState().setCategory({ id: 'heating', name: 'Отопление' });
      await renderWithProviders(<NewRequestScreen />);

      await type(HEATING_TEXT);
      await waitFor(() => expect(submit()).toBeEnabled());
      await fireEvent.press(submit());

      expect(
        await screen.findByText('Привяжите квартиру, чтобы отправить заявку'),
      ).toBeOnTheScreen();
      expect(createRequest).not.toHaveBeenCalled();
    });
  });

  describe('отправка', () => {
    async function fillValid() {
      useRequestDraft.getState().setCategory({ id: 'heating', name: 'Отопление' });
      await renderWithProviders(<NewRequestScreen />);
      await type(`  ${HEATING_TEXT}  `);
      await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');
    }

    it('шлёт категорию, описание без пробелов по краям и привязку, очищает черновик', async () => {
      const createRequest = jest.fn().mockResolvedValue({
        id: 'request-1',
        number: 1001,
        createdAt: '2026-11-22T10:00:00.000Z',
        status: 'new' as const,
        answerWithinMin: 15,
      });
      setApi(fakeApi({ createRequest }));
      await fillValid();

      await fireEvent.press(submit());

      await waitFor(() =>
        expect(createRequest).toHaveBeenCalledWith({
          categoryId: 'heating',
          description: HEATING_TEXT,
          residencyId: 'residency-1',
          attachmentIds: [],
          clientRequestId: expect.any(String),
        }),
      );
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/requests/sent'));
      expect(useRequestDraft.getState()).toMatchObject({ category: null, description: '' });
    });

    it('двойное нажатие отправляет один запрос', async () => {
      const createRequest = jest.fn(() => new Promise<CreateRequestResult>(() => undefined));
      setApi(fakeApi({ createRequest }));
      await fillValid();

      await fireEvent.press(submit());
      await fireEvent.press(submit());

      expect(createRequest).toHaveBeenCalledTimes(1);
    });

    it('при ошибке сети сохраняет черновик и открывает экран «Не удалось отправить»', async () => {
      const createRequest = jest.fn().mockRejectedValue(new Error('network'));
      setApi(fakeApi({ createRequest }));
      await fillValid();

      await fireEvent.press(submit());

      await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith({
          pathname: '/requests/failed',
          params: { reason: 'network' },
        }),
      );
      expect(useRequestDraft.getState().description).toContain('Нет отопления');
      expect(useRequestDraft.getState().category?.id).toBe('heating');
    });

    it('если сервер не принял заявку, причина «rejected»', async () => {
      const createRequest = jest.fn().mockRejectedValue(new ApiError('validation'));
      setApi(fakeApi({ createRequest }));
      await fillValid();

      await fireEvent.press(submit());

      await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith({
          pathname: '/requests/failed',
          params: { reason: 'rejected' },
        }),
      );
    });
  });

  describe('черновик', () => {
    it('восстанавливает категорию и описание при повторном открытии', async () => {
      setApi(fakeApi());
      useRequestDraft.getState().setCategory({ id: 'water', name: 'Водоснабжение' });
      useRequestDraft.getState().setDescription('Течёт кран на кухне');

      await renderWithProviders(<NewRequestScreen />);

      expect(screen.getByText('Водоснабжение')).toBeOnTheScreen();
      expect(description()).toHaveDisplayValue('Течёт кран на кухне');
    });
  });
});
