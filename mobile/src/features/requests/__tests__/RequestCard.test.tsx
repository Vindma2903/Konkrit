import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError, setApi, type ApiClient, type RequestDetails } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { renderWithProviders } from '@/test/utils';

import { RequestCardScreen } from '../card/RequestCardScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
  useFocusEffect: jest.fn(),
}));

function api(overrides: Partial<ApiClient> = {}): ApiClient {
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

function open(id: string) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id });
}

/** Проверяет цвета четырёх сегментов шкалы. */
function expectSteps(colors: string[]) {
  colors.forEach((color, index) => {
    expect(screen.getByTestId(`progress-step-${index}`)).toHaveStyle({ backgroundColor: color });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('карточка заявки', () => {
  it('сначала «Загружаем заявку…», затем шапка, сводка, шкала и люди', async () => {
    open('request-seed-3');
    setApi(api());
    await renderWithProviders(<RequestCardScreen />);
    expect(screen.getByTestId('card-loading')).toHaveTextContent('Загружаем заявку…');

    expect(await screen.findByText('Заявка № 903')).toBeOnTheScreen();
    expect(screen.getByText('Течёт кран на кухне')).toBeOnTheScreen();
    expect(screen.getByTestId('card-status')).toHaveTextContent('В работе');
    expect(screen.getByText(/^Создана \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/)).toBeOnTheScreen();
    expect(screen.getByTestId('person-curator')).toHaveTextContent(
      'Куратор' + 'Ольга Смирнова, главный инженер',
    );
    expect(screen.getByTestId('person-executor')).toHaveTextContent(
      'Исполнитель' + 'Сергей Петров, сантехник',
    );
  });

  it('шкала: при «В работе» закрашены первые два сегмента', async () => {
    open('request-seed-3');
    setApi(api());
    await renderWithProviders(<RequestCardScreen />);
    await screen.findByText('Заявка № 903');

    expectSteps(['#CC3D3D', '#CC3D3D', '#E6E7E8', '#E6E7E8']);
    for (const label of ['Новая', 'Ожидание', 'Завершена']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('новая заявка без назначенных: «Не назначен» у куратора и исполнителя', async () => {
    open('request-seed-2');
    setApi(api());
    await renderWithProviders(<RequestCardScreen />);
    await screen.findByText('Заявка № 904');

    expect(screen.getByTestId('person-curator')).toHaveTextContent('КураторНе назначен');
    expect(screen.getByTestId('person-executor')).toHaveTextContent('ИсполнительНе назначен');
    expectSteps(['#CC3D3D', '#E6E7E8', '#E6E7E8', '#E6E7E8']);
  });

  it('отменённая заявка: плашка «Отменена», шкала серая', async () => {
    open('request-x');
    const cancelled: RequestDetails = {
      id: 'request-x',
      number: 777,
      title: 'Тест',
      categoryName: 'Другое',
      status: 'cancelled',
      executor: null,
      curator: null,
      createdAt: '2026-11-22T10:00:00.000Z',
      address: 'Адрес',
    };
    setApi(api({ getRequest: jest.fn().mockResolvedValue(cancelled) }));
    await renderWithProviders(<RequestCardScreen />);
    await screen.findByText('Заявка № 777');

    expect(screen.getByTestId('card-status')).toHaveTextContent('Отменена');
    expectSteps(['#E6E7E8', '#E6E7E8', '#E6E7E8', '#E6E7E8']);
  });

  it('заявки нет: «Заявка не найдена» и «К списку заявок»', async () => {
    open('нет-такой');
    setApi(api());
    await renderWithProviders(<RequestCardScreen />);

    expect(await screen.findByText('Заявка не найдена')).toBeOnTheScreen();
    expect(screen.getByText('Заявка')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('card-to-list'));
    expect(router.replace).toHaveBeenCalledWith('/requests');
  });

  it('ошибка загрузки: сообщение и «Повторить»', async () => {
    open('request-seed-3');
    const getRequest = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(createMockApi({ delayMs: 0 }).getRequest);
    setApi(api({ getRequest }));
    await renderWithProviders(<RequestCardScreen />);

    expect(await screen.findByText('Не удалось загрузить заявку')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('card-retry'));

    expect(await screen.findByText('Заявка № 903')).toBeOnTheScreen();
  });
});

describe('вкладки карточки', () => {
  it('по умолчанию «Чат»; переключатель оформлен как на входе', async () => {
    open('request-seed-3');
    setApi(api());
    await renderWithProviders(<RequestCardScreen />);
    await screen.findByText('Заявка № 903');

    expect(screen.getByTestId('card-tab-chat')).toBeSelected();
    expect(screen.getByTestId('card-tab-history')).not.toBeSelected();
    expect(await screen.findByTestId('chat-input')).toBeOnTheScreen();
  });

  it('«История»: события от новых к старым с датой', async () => {
    open('request-seed-3');
    setApi(api());
    await renderWithProviders(<RequestCardScreen />);
    await screen.findByText('Заявка № 903');

    await fireEvent.press(screen.getByTestId('card-tab-history'));

    expect(await screen.findByTestId('history-list')).toBeOnTheScreen();
    const texts = screen
      .getAllByTestId(/^history-event-/)
      .map((node) => node.props.children as unknown).length;
    expect(texts).toBe(4);
    expect(screen.getByText('Статус изменён: В работе')).toBeOnTheScreen();
    expect(screen.getByText('Заявка создана')).toBeOnTheScreen();
    // Сводка остаётся на месте.
    expect(screen.getByText('Течёт кран на кухне')).toBeOnTheScreen();
  });

  it('«История»: ошибка и «Повторить»', async () => {
    open('request-seed-3');
    const listHistory = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(createMockApi({ delayMs: 0 }).listHistory);
    setApi(api({ listHistory }));
    await renderWithProviders(<RequestCardScreen />);
    await screen.findByText('Заявка № 903');

    await fireEvent.press(screen.getByTestId('card-tab-history'));
    expect(await screen.findByText('Не удалось загрузить историю')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('history-retry'));

    expect(await screen.findByText('Заявка создана')).toBeOnTheScreen();
  });

  it('«Файлы»: имя и размер строкой', async () => {
    open('request-seed-3');
    setApi(api());
    await renderWithProviders(<RequestCardScreen />);
    await screen.findByText('Заявка № 903');

    await fireEvent.press(screen.getByTestId('card-tab-files'));

    expect(await screen.findByText('fotootchet.jpg')).toBeOnTheScreen();
    expect(screen.getByText('1,3 МБ')).toBeOnTheScreen();
  });

  it('«Файлы»: у заявки без файлов «Файлов пока нет»', async () => {
    open('request-seed-2');
    setApi(api());
    await renderWithProviders(<RequestCardScreen />);
    await screen.findByText('Заявка № 904');

    await fireEvent.press(screen.getByTestId('card-tab-files'));

    expect(await screen.findByText('Файлов пока нет')).toBeOnTheScreen();
  });

  it('чат не теряет введённый текст при переключении вкладок', async () => {
    open('request-seed-3');
    setApi(api());
    await renderWithProviders(<RequestCardScreen />);
    await screen.findByText('Заявка № 903');
    await fireEvent.changeText(await screen.findByTestId('chat-input'), 'Когда придёте?');

    await fireEvent.press(screen.getByTestId('card-tab-history'));
    await screen.findByTestId('history-list');
    await fireEvent.press(screen.getByTestId('card-tab-chat'));

    expect(screen.getByTestId('chat-input')).toHaveDisplayValue('Когда придёте?');
  });
});

describe('открытие по идентификатору', () => {
  it('без идентификатора показывает «Заявка не найдена»', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({});
    setApi(api());
    await renderWithProviders(<RequestCardScreen />);
    expect(await screen.findByText('Заявка не найдена')).toBeOnTheScreen();
  });

  it('запрашивает именно эту заявку', async () => {
    open('request-seed-5');
    const getRequest = jest.fn(createMockApi({ delayMs: 0 }).getRequest);
    setApi(api({ getRequest }));
    await renderWithProviders(<RequestCardScreen />);

    await waitFor(() => expect(getRequest).toHaveBeenCalledWith('request-seed-5'));
    expect(await screen.findByText('Заявка № 901')).toBeOnTheScreen();
  });
});
