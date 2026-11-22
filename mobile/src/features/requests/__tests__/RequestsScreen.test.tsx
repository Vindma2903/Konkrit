import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useFocusEffect } from 'expo-router';

import { ApiError, setApi, type ApiClient, type RequestSummary } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { renderWithProviders } from '@/test/utils';

import { useRequestDraft } from '../draftStore';
import { RequestsScreen } from '../RequestsScreen';
import { discardDraft } from '../uploader';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function api(overrides: Partial<ApiClient> = {}, pageSize?: number): ApiClient {
  return { ...createMockApi({ delayMs: 0, pageSize }), ...overrides };
}

const card = (id: string) => screen.getByTestId(`request-card-${id}`);

beforeEach(async () => {
  jest.clearAllMocks();
  await discardDraft();
  await flush();
});

describe('«Мои заявки»', () => {
  it('сначала «Загружаем заявки…», затем карточки по макету: категория, статус, заголовок, исполнитель', async () => {
    setApi(api());
    await renderWithProviders(<RequestsScreen />);
    expect(screen.getByTestId('requests-loading')).toHaveTextContent('Загружаем заявки…');

    expect(await screen.findByText('Холодные батареи в комнате')).toBeOnTheScreen();
    expect(screen.getByText('Мои заявки')).toBeOnTheScreen();
    expect(screen.getByText('Течёт кран на кухне')).toBeOnTheScreen();
    expect(screen.getAllByText('Исполнитель: Не назначен')).toHaveLength(2);
    expect(screen.getByText('Исполнитель: Сергей Петров, сантехник')).toBeOnTheScreen();
    expect(screen.getByText('Протечка')).toBeOnTheScreen();
    expect(screen.getAllByText('В работе').length).toBeGreaterThan(0);
    expect(screen.getByText('Завершена')).toBeOnTheScreen();
  });

  it('карточка открывает заявку по идентификатору', async () => {
    setApi(api());
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');

    await fireEvent.press(card('request-seed-3'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/requests/[id]',
      params: { id: 'request-seed-3' },
    });
  });

  it('«Новая заявка» открывает форму', async () => {
    setApi(api());
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');

    await fireEvent.press(screen.getByTestId('requests-new'));

    expect(router.push).toHaveBeenCalledWith('/requests/new');
  });
});

describe('фильтры', () => {
  it('по умолчанию «Все», «В работе» показывает В работе и Ожидание', async () => {
    const listRequests = jest.fn(createMockApi({ delayMs: 0 }).listRequests);
    setApi(api({ listRequests }));
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');
    expect(screen.getByTestId('filter-all')).toBeSelected();
    expect(listRequests).toHaveBeenLastCalledWith({ statuses: undefined, cursor: null });

    await fireEvent.press(screen.getByTestId('filter-in_progress'));

    await waitFor(() =>
      expect(listRequests).toHaveBeenLastCalledWith({
        statuses: ['in_progress', 'waiting'],
        cursor: null,
      }),
    );
    expect(screen.getByTestId('filter-in_progress')).toBeSelected();
    expect(screen.getByTestId('filter-all')).not.toBeSelected();
    await waitFor(() =>
      expect(screen.queryByText('Холодные батареи в комнате')).not.toBeOnTheScreen(),
    );
    expect(screen.getByText('Течёт кран на кухне')).toBeOnTheScreen();
    expect(screen.getByText('Лифт не доезжает до 9 этажа')).toBeOnTheScreen();
  });

  it('«Новые» и «Завершены» отбирают свои статусы', async () => {
    const listRequests = jest.fn(createMockApi({ delayMs: 0 }).listRequests);
    setApi(api({ listRequests }));
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');

    await fireEvent.press(screen.getByTestId('filter-new'));
    await waitFor(() =>
      expect(listRequests).toHaveBeenLastCalledWith({ statuses: ['new'], cursor: null }),
    );
    await fireEvent.press(screen.getByTestId('filter-completed'));
    await waitFor(() =>
      expect(listRequests).toHaveBeenLastCalledWith({
        statuses: ['completed', 'cancelled'],
        cursor: null,
      }),
    );
    expect(await screen.findByText('Нет света в подъезде')).toBeOnTheScreen();
  });

  it('пустой фильтр объясняется', async () => {
    const listRequests = jest.fn(async ({ statuses }: { statuses?: string[] }) => ({
      items: statuses ? [] : [],
      nextCursor: null,
    }));
    setApi(api({ listRequests: listRequests as ApiClient['listRequests'] }));
    await renderWithProviders(<RequestsScreen />);
    await fireEvent.press(screen.getByTestId('filter-new'));

    expect(await screen.findByTestId('requests-filter-empty')).toHaveTextContent(
      'В этом разделе заявок нет',
    );
  });

  it('активный фильтр светло-коралловый, а не сплошной', async () => {
    setApi(api());
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');

    expect(screen.getByTestId('filter-all')).toHaveStyle({ backgroundColor: '#FDECEC' });
  });
});

describe('состояния списка', () => {
  it('заявок нет и нет черновика: «Заявок пока нет» и «Создать заявку»', async () => {
    setApi(api({ listRequests: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) }));
    await renderWithProviders(<RequestsScreen />);

    expect(await screen.findByText('Заявок пока нет')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('requests-create'));
    expect(router.push).toHaveBeenCalledWith('/requests/new');
  });

  it('ошибка загрузки: сообщение и «Повторить» загружает список', async () => {
    const listRequests = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(createMockApi({ delayMs: 0 }).listRequests);
    setApi(api({ listRequests }));
    await renderWithProviders(<RequestsScreen />);

    expect(await screen.findByText('Не удалось загрузить заявки')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('requests-retry'));

    expect(await screen.findByText('Течёт кран на кухне')).toBeOnTheScreen();
  });

  it('при сбое дозагрузки загруженные карточки остаются, есть «Повторить»', async () => {
    const real = createMockApi({ delayMs: 0, pageSize: 2 });
    const listRequests = jest
      .fn()
      .mockImplementationOnce(real.listRequests)
      .mockRejectedValue(new ApiError('network'));
    setApi(api({ listRequests }, 2));
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Холодные батареи в комнате');

    await fireEvent(screen.getByTestId('requests-list'), 'endReached');

    expect(await screen.findByText('Не удалось загрузить заявки')).toBeOnTheScreen();
    expect(screen.getByText('Холодные батареи в комнате')).toBeOnTheScreen();
  });
});

describe('обновление и дозагрузка', () => {
  it('дозагружает следующую страницу по концу списка без дублей', async () => {
    const listRequests = jest.fn(createMockApi({ delayMs: 0, pageSize: 2 }).listRequests);
    setApi(api({ listRequests }, 2));
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Холодные батареи в комнате');
    expect(screen.queryByText('Нет света в подъезде')).not.toBeOnTheScreen();

    await fireEvent(screen.getByTestId('requests-list'), 'endReached');
    await waitFor(() => expect(listRequests).toHaveBeenCalledTimes(2));
    await screen.findByText('Лифт не доезжает до 9 этажа');
    await fireEvent(screen.getByTestId('requests-list'), 'endReached');
    await waitFor(() => expect(listRequests).toHaveBeenCalledTimes(3));

    expect(await screen.findByText('Нет света в подъезде')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^request-card-/)).toHaveLength(5);
    expect(listRequests.mock.calls[1]?.[0]).toMatchObject({ cursor: '2' });
  });

  it('когда страниц больше нет, конец списка ничего не запрашивает', async () => {
    const listRequests = jest.fn(createMockApi({ delayMs: 0 }).listRequests);
    setApi(api({ listRequests }));
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');

    await fireEvent(screen.getByTestId('requests-list'), 'endReached');
    await flush();

    expect(listRequests).toHaveBeenCalledTimes(1);
  });

  it('«потянуть вниз» загружает список заново', async () => {
    const listRequests = jest.fn(createMockApi({ delayMs: 0 }).listRequests);
    setApi(api({ listRequests }));
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');

    await fireEvent(screen.getByTestId('requests-list'), 'refresh');

    await waitFor(() => expect(listRequests).toHaveBeenCalledTimes(2));
  });

  it('при возврате на вкладку список обновляется, но не при первом показе', async () => {
    const listRequests = jest.fn(createMockApi({ delayMs: 0 }).listRequests);
    setApi(api({ listRequests }));
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');
    const focus = jest.mocked(useFocusEffect).mock.calls.at(-1)?.[0] as () => void;

    await act(async () => focus());
    await flush();
    expect(listRequests).toHaveBeenCalledTimes(1);

    await act(async () => focus());
    await waitFor(() => expect(listRequests).toHaveBeenCalledTimes(2));
  });
});

describe('черновик в списке', () => {
  it('показывает карточку черновика над заявками, нажатие открывает форму', async () => {
    useRequestDraft.setState({
      category: { id: 'leak', name: 'Протечка' },
      description: 'Течёт труба в ванной',
    });
    setApi(api());
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');

    expect(screen.getByTestId('draft-card')).toBeOnTheScreen();
    expect(screen.getByText('Течёт труба в ванной')).toBeOnTheScreen();
    expect(screen.getByText('Черновик')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('draft-card'));
    expect(router.push).toHaveBeenCalledWith('/requests/new');
  });

  it('карточка черновика не зависит от фильтра', async () => {
    useRequestDraft.setState({ description: 'Течёт труба' });
    setApi(api());
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');

    await fireEvent.press(screen.getByTestId('filter-completed'));

    await screen.findByText('Нет света в подъезде');
    expect(screen.getByTestId('draft-card')).toBeOnTheScreen();
  });

  it('без черновика карточки нет', async () => {
    setApi(api());
    await renderWithProviders(<RequestsScreen />);
    await screen.findByText('Течёт кран на кухне');
    expect(screen.queryByTestId('draft-card')).not.toBeOnTheScreen();
  });

  it('если заявок нет, но есть черновик, «Заявок пока нет» не показывается', async () => {
    useRequestDraft.setState({ description: 'Течёт труба' });
    setApi(api({ listRequests: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) }));
    await renderWithProviders(<RequestsScreen />);

    expect(await screen.findByTestId('draft-card')).toBeOnTheScreen();
    expect(screen.queryByTestId('requests-empty')).not.toBeOnTheScreen();
  });
});

export type { RequestSummary };
