import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Share } from 'react-native';

import { ApiError, setApi, type ApiClient } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { renderWithProviders } from '@/test/utils';

import { NewsDetailsScreen, shareMessage } from '../NewsDetailsScreen';
import { NewsScreen } from '../NewsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
  useFocusEffect: jest.fn(),
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function api(overrides: Partial<ApiClient> = {}, pageSize?: number): ApiClient {
  return { ...createMockApi({ delayMs: 0, pageSize }), ...overrides };
}

beforeEach(() => jest.clearAllMocks());

describe('вкладка «Новости»', () => {
  it('сначала «Загружаем новости…», затем карточки с датой, заголовком и превью', async () => {
    setApi(api());
    await renderWithProviders(<NewsScreen />);
    expect(screen.getByTestId('news-loading')).toHaveTextContent('Загружаем новости…');

    expect(await screen.findByText('Плановое отключение горячей воды')).toBeOnTheScreen();
    expect(screen.getByText('Начался ремонт лифта в подъезде 2')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^news-card-news-\d$/)).toHaveLength(5);
    // превью — не больше двух строк
    expect(
      screen.getByText(/^Плановое отключение горячей воды\. Что нужно знать/).props.numberOfLines,
    ).toBe(2);
    // самая старая новость — прошлого года: дата с годом
    expect(screen.getByLabelText(/\d{4}\. Новая парковочная схема во дворе/)).toBeOnTheScreen();
  });

  it('по умолчанию «Новости»; «Объявления» показывают объявления, выбранный пункт выделен', async () => {
    setApi(api());
    await renderWithProviders(<NewsScreen />);
    await screen.findByText('Плановое отключение горячей воды');
    expect(screen.getByTestId('news-kind-news')).toBeSelected();
    expect(screen.getByTestId('news-kind-announcement')).not.toBeSelected();

    await fireEvent.press(screen.getByTestId('news-kind-announcement'));

    expect(await screen.findByText('Субботник во дворе')).toBeOnTheScreen();
    expect(screen.getByTestId('news-kind-announcement')).toBeSelected();
    expect(screen.queryByText('Плановое отключение горячей воды')).toBeNull();
  });

  it('при возврате на «Новости» загруженный список не теряется и не показывает «Загружаем»', async () => {
    setApi(api());
    await renderWithProviders(<NewsScreen />);
    await screen.findByText('Плановое отключение горячей воды');
    await fireEvent.press(screen.getByTestId('news-kind-announcement'));
    await screen.findByText('Субботник во дворе');

    await fireEvent.press(screen.getByTestId('news-kind-news'));

    expect(screen.queryByTestId('news-loading')).toBeNull();
    expect(await screen.findByText('Плановое отключение горячей воды')).toBeOnTheScreen();
  });

  it('карточка открывает новость по идентификатору', async () => {
    setApi(api());
    await renderWithProviders(<NewsScreen />);
    await screen.findByText('Плановое отключение горячей воды');

    await fireEvent.press(screen.getByTestId('news-card-news-2'));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/news/[id]', params: { id: 'news-2' } });
  });

  it('нет картинки — серая заглушка', async () => {
    setApi(api());
    await renderWithProviders(<NewsScreen />);
    await screen.findByText('Плановое отключение горячей воды');
    expect(screen.queryByTestId('news-card-news-1-media-image')).toBeNull();
    expect(screen.getByTestId('news-card-news-1-media')).toBeOnTheScreen();
  });

  it('есть картинка — показывается; не загрузилась — заглушка', async () => {
    const real = createMockApi({ delayMs: 0 });
    setApi(
      api({
        listNews: async (input) => {
          const page = await real.listNews(input);
          return {
            ...page,
            items: page.items.map((item) => ({ ...item, imageUrl: 'https://example.test/a.jpg' })),
          };
        },
      }),
    );
    await renderWithProviders(<NewsScreen />);
    const image = await screen.findByTestId('news-card-news-1-media-image');
    expect(image).toBeOnTheScreen();
    await fireEvent(image, 'error');
    await waitFor(() => expect(screen.queryByTestId('news-card-news-1-media-image')).toBeNull());
  });

  it('пустой раздел: «Пока нет новостей» и «Пока нет объявлений»', async () => {
    setApi(api({ listNews: async () => ({ items: [], nextCursor: null }) }));
    await renderWithProviders(<NewsScreen />);
    expect(await screen.findByTestId('news-empty')).toHaveTextContent('Пока нет новостей');
    await fireEvent.press(screen.getByTestId('news-kind-announcement'));
    await waitFor(() => expect(screen.getByTestId('news-empty')).toHaveTextContent('Пока нет объявлений'));
  });

  it('ошибка: сообщение и «Повторить» загружает список', async () => {
    const real = createMockApi({ delayMs: 0 });
    const listNews = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(real.listNews);
    setApi(api({ listNews }));
    await renderWithProviders(<NewsScreen />);
    expect(await screen.findByText('Не удалось загрузить новости')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('news-retry'));

    expect(await screen.findByText('Плановое отключение горячей воды')).toBeOnTheScreen();
  });

  it('дозагрузка по концу списка без повторов', async () => {
    const listNews = jest.fn(createMockApi({ delayMs: 0, pageSize: 2 }).listNews);
    setApi(api({ listNews }, 2));
    await renderWithProviders(<NewsScreen />);
    await screen.findByText('Плановое отключение горячей воды');
    expect(screen.getAllByTestId(/^news-card-news-\d$/)).toHaveLength(2);

    await fireEvent(screen.getByTestId('news-list'), 'endReached');
    await waitFor(() => expect(listNews).toHaveBeenCalledTimes(2));
    await screen.findByText('Итоги общего собрания собственников');
    await fireEvent(screen.getByTestId('news-list'), 'endReached');
    await waitFor(() => expect(listNews).toHaveBeenCalledTimes(3));

    expect(await screen.findByText('Новая парковочная схема во дворе')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^news-card-news-\d$/)).toHaveLength(5);
    expect(listNews.mock.calls[1]?.[0]).toMatchObject({ kind: 'news', cursor: '2' });
  });

  it('сбой дозагрузки: карточки остаются, внизу «Не удалось загрузить новости» и «Повторить»', async () => {
    const real = createMockApi({ delayMs: 0, pageSize: 2 });
    const listNews = jest
      .fn()
      .mockImplementationOnce(real.listNews)
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(real.listNews);
    setApi(api({ listNews }, 2));
    await renderWithProviders(<NewsScreen />);
    await screen.findByText('Плановое отключение горячей воды');

    await fireEvent(screen.getByTestId('news-list'), 'endReached');
    expect(await screen.findByText('Не удалось загрузить новости')).toBeOnTheScreen();
    expect(screen.getByText('Плановое отключение горячей воды')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('news-retry'));
    expect(await screen.findByText('Итоги общего собрания собственников')).toBeOnTheScreen();
  });

  it('«потянуть вниз» и возврат на вкладку обновляют список, но не при первом показе', async () => {
    const listNews = jest.fn(createMockApi({ delayMs: 0 }).listNews);
    setApi(api({ listNews }));
    await renderWithProviders(<NewsScreen />);
    await screen.findByText('Плановое отключение горячей воды');
    const focus = jest.mocked(useFocusEffect).mock.calls.at(-1)?.[0] as () => void;

    await act(async () => focus());
    await flush();
    expect(listNews).toHaveBeenCalledTimes(1);

    await act(async () => focus());
    await waitFor(() => expect(listNews).toHaveBeenCalledTimes(2));

    await fireEvent(screen.getByTestId('news-list'), 'refresh');
    await waitFor(() => expect(listNews).toHaveBeenCalledTimes(3));
  });
});

describe('экран новости', () => {
  const open = (id: string) => jest.mocked(useLocalSearchParams).mockReturnValue({ id });

  it('картинка, дата, заголовок и абзацы текста; «Поделиться» закреплена', async () => {
    open('news-1');
    setApi(api());
    await renderWithProviders(<NewsDetailsScreen />);
    expect(screen.getByTestId('news-details-loading')).toHaveTextContent('Загружаем новость…');

    expect(await screen.findByText('Плановое отключение горячей воды')).toBeOnTheScreen();
    expect(screen.getByText('Новость')).toBeOnTheScreen();
    expect(screen.getByTestId('news-details-media')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^news-paragraph-/)).toHaveLength(3);
    expect(screen.getByTestId('news-share')).toBeOnTheScreen();
  });

  it('«Поделиться» открывает системное окно с заголовком и первым абзацем', async () => {
    open('news-1');
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    setApi(api());
    await renderWithProviders(<NewsDetailsScreen />);
    await screen.findByText('Плановое отключение горячей воды');

    await fireEvent.press(screen.getByTestId('news-share'));

    const details = await createMockApi({ delayMs: 0 }).getNews('news-1');
    expect(share).toHaveBeenCalledWith({ message: shareMessage(details) });
    expect(share.mock.calls[0]?.[0]).toEqual({
      message: `${details.title}\n\n${details.body[0]}`,
    });
    share.mockRestore();
  });

  it('если житель закрыл окно или оно не открылось, ошибки нет', async () => {
    open('news-1');
    const share = jest.spyOn(Share, 'share').mockRejectedValue(new Error('закрыто'));
    setApi(api());
    await renderWithProviders(<NewsDetailsScreen />);
    await screen.findByText('Плановое отключение горячей воды');

    await fireEvent.press(screen.getByTestId('news-share'));
    await flush();

    expect(screen.getByText('Плановое отключение горячей воды')).toBeOnTheScreen();
    expect(screen.queryByText(/Не удалось/)).toBeNull();
    share.mockRestore();
  });

  it('новости нет: «Новость не найдена», «К новостям» открывает вкладку', async () => {
    open('missing');
    setApi(api());
    await renderWithProviders(<NewsDetailsScreen />);
    expect(await screen.findByText('Новость не найдена')).toBeOnTheScreen();
    expect(screen.queryByTestId('news-share')).toBeNull();

    await fireEvent.press(screen.getByTestId('news-to-list'));

    expect(router.replace).toHaveBeenCalledWith('/home');
  });

  it('ошибка загрузки: «Не удалось загрузить новость» и «Повторить»', async () => {
    open('news-1');
    const real = createMockApi({ delayMs: 0 });
    const getNews = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(real.getNews);
    setApi(api({ getNews }));
    await renderWithProviders(<NewsDetailsScreen />);
    expect(await screen.findByText('Не удалось загрузить новость')).toBeOnTheScreen();
    expect(screen.queryByText('Новость не найдена')).toBeNull();

    await fireEvent.press(screen.getByTestId('news-details-retry'));

    expect(await screen.findByText('Плановое отключение горячей воды')).toBeOnTheScreen();
  });
});
