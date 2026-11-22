import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { BackHandler } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useCreatedRequest } from '../createdRequestStore';
import { RequestDetailsStub } from '../RequestDetailsStub';
import { RequestFailedScreen } from '../RequestFailedScreen';
import { RequestSentScreen } from '../RequestSentScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
  Redirect: jest.fn(() => null),
  useLocalSearchParams: jest.fn(() => ({})),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const withProvider = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

const summary = {
  id: 'request-1',
  number: 1042,
  createdAt: '2026-11-22T10:05:00',
  categoryName: 'Отопление',
  address: 'г. Оренбург, ул. Тестовая, д. 1, кв. 12',
  answerWithinMin: 15,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useLocalSearchParams).mockReturnValue({});
  useCreatedRequest.getState().setSummary(null);
});

describe('S9: заявка создана', () => {
  it('показывает номер, карточку с категорией, адресом, статусом и сроком ответа', async () => {
    useCreatedRequest.getState().setSummary(summary);
    await withProvider(<RequestSentScreen />);

    expect(screen.getByText('Заявка № 1042 создана')).toBeOnTheScreen();
    expect(
      screen.getByText('Мы уведомим вас в MAX и push, когда статус изменится.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('22.11.2026, 10:05')).toBeOnTheScreen();
    expect(screen.getByText('Новая')).toBeOnTheScreen();
    expect(screen.getByText('Отопление')).toBeOnTheScreen();
    expect(screen.getByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12')).toBeOnTheScreen();
    expect(screen.getByText('Диспетчер ответит в течение 15 мин')).toBeOnTheScreen();
  });

  it('«Открыть заявку» ведёт на заглушку карточки с номером', async () => {
    useCreatedRequest.getState().setSummary(summary);
    await withProvider(<RequestSentScreen />);

    await fireEvent.press(screen.getByTestId('request-sent-open'));

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/requests/details',
      params: { number: '1042' },
    });
  });

  it('«На главную» возвращает на главную без лишних экранов', async () => {
    useCreatedRequest.getState().setSummary(summary);
    await withProvider(<RequestSentScreen />);

    await fireEvent.press(screen.getByTestId('request-sent-home'));

    expect(router.dismissTo).toHaveBeenCalledWith('/home');
  });

  it('системная «Назад» ведёт на главную, а не в форму', async () => {
    useCreatedRequest.getState().setSummary(summary);
    let handler: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    const add = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, callback) => {
        handler = callback;
        return { remove: jest.fn() };
      });
    await withProvider(<RequestSentScreen />);

    let handled = false;
    await act(async () => {
      handled = handler?.({} as never) ?? false;
    });

    expect(handled).toBe(true);
    expect(router.dismissTo).toHaveBeenCalledWith('/home');
    add.mockRestore();
  });

  it('без итога заявки (например, экран открыт заново) возвращает на главную', async () => {
    await withProvider(<RequestSentScreen />);
    expect(jest.mocked(Redirect).mock.calls[0]?.[0]).toMatchObject({ href: '/home' });
  });
});

describe('S10: не удалось отправить', () => {
  it('при сбое сети: черновик сохранён, повторить позже', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ reason: 'network' });
    await withProvider(<RequestFailedScreen />);

    expect(screen.getByText('Не удалось отправить')).toBeOnTheScreen();
    expect(screen.getByTestId('request-failed-text')).toHaveTextContent(
      'Нет связи с интернетом. Черновик сохранён. Повторите, когда появится сеть.',
    );
  });

  it('«Повторить» после сбоя сети открывает форму с автоотправкой', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ reason: 'network' });
    await withProvider(<RequestFailedScreen />);

    await fireEvent.press(screen.getByTestId('request-failed-retry'));

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/requests/new',
      params: { retry: '1' },
    });
  });

  it('если сервер не принял заявку, текст другой и форма открывается без автоотправки', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ reason: 'rejected' });
    await withProvider(<RequestFailedScreen />);

    expect(screen.getByTestId('request-failed-text')).toHaveTextContent(
      'Сервер не принял заявку. Проверьте данные и попробуйте снова.',
    );
    await fireEvent.press(screen.getByTestId('request-failed-retry'));

    expect(router.replace).toHaveBeenCalledWith({ pathname: '/requests/new', params: {} });
  });

  it('«Закрыть, оставить в черновиках» ведёт на главную', async () => {
    await withProvider(<RequestFailedScreen />);

    await fireEvent.press(screen.getByTestId('request-failed-close'));

    expect(router.dismissTo).toHaveBeenCalledWith('/home');
  });
});

describe('заглушка карточки заявки', () => {
  it('показывает номер заявки и ведёт на главную', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ number: '1042' });
    await withProvider(<RequestDetailsStub />);

    expect(screen.getByText('Заявка № 1042')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('details-home'));
    expect(router.dismissTo).toHaveBeenCalledWith('/home');
  });
});
