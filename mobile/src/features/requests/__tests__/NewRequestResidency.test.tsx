import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { setApi, type ApiClient, type Residency } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { renderWithProviders } from '@/test/utils';

import { useRequestDraft } from '../draftStore';
import { NewRequestScreen } from '../NewRequestScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  Redirect: jest.fn(() => null),
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
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

const submit = () => screen.getByRole('button', { name: 'Отправить заявку' });

describe('NewRequestScreen: привязка квартиры', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRequestDraft.getState().reset();
    useRequestDraft.getState().setCategory({ id: 'heating', name: 'Отопление' });
    useRequestDraft.getState().setDescription('Нет отопления во всей квартире с утра');
  });

  it('пока адрес загружается, заявка не уходит без привязки', async () => {
    const createRequest = jest.fn();
    const getResidencies = jest.fn(() => new Promise<Residency[]>(() => undefined));
    setApi(fakeApi({ getResidencies, createRequest }));
    await renderWithProviders(<NewRequestScreen />);

    await fireEvent.press(submit());

    expect(createRequest).not.toHaveBeenCalled();
  });

  it('когда адрес загрузился, заявка уходит с настоящим идентификатором привязки', async () => {
    const createRequest = jest.fn().mockResolvedValue({
      id: 'request-1',
      number: 1001,
      createdAt: '2026-11-22T10:00:00.000Z',
      status: 'new' as const,
      answerWithinMin: 15,
    });
    setApi(fakeApi({ getResidencies: jest.fn().mockResolvedValue([residency]), createRequest }));
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');

    await fireEvent.press(submit());

    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ residencyId: 'residency-1' }),
      ),
    );
  });

  it('если адрес не загрузился, нажатие перезапрашивает его, а заявка без привязки не уходит', async () => {
    let finishRetry: (value: Residency[]) => void = () => undefined;
    const getResidencies = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementationOnce(() => new Promise<Residency[]>((done) => (finishRetry = done)));
    const createRequest = jest.fn().mockResolvedValue({
      id: 'request-1',
      number: 1001,
      createdAt: '2026-11-22T10:00:00.000Z',
      status: 'new' as const,
      answerWithinMin: 15,
    });
    setApi(fakeApi({ getResidencies, createRequest }));
    await renderWithProviders(<NewRequestScreen />);
    await waitFor(() => expect(getResidencies).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submit()).toBeEnabled());

    await fireEvent.press(submit());

    // Адрес перезапрашивается, заявка без привязки не уходит.
    await waitFor(() => expect(getResidencies).toHaveBeenCalledTimes(2));
    expect(createRequest).not.toHaveBeenCalled();
    expect(screen.queryByText('Привяжите квартиру, чтобы отправить заявку')).not.toBeOnTheScreen();

    await act(async () => finishRetry([residency]));
    expect(await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12')).toBeOnTheScreen();
  });

  it('если адрес так и не загрузился, пишет про сбой загрузки, а не «привяжите квартиру»', async () => {
    const getResidencies = jest.fn().mockRejectedValue(new Error('network'));
    const createRequest = jest.fn();
    setApi(fakeApi({ getResidencies, createRequest }));
    await renderWithProviders(<NewRequestScreen />);
    await waitFor(() => expect(getResidencies).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submit()).toBeEnabled());

    await fireEvent.press(submit());

    expect(
      await screen.findByText(
        'Не удалось загрузить адрес. Проверьте соединение и попробуйте снова',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Привяжите квартиру, чтобы отправить заявку')).not.toBeOnTheScreen();
    expect(createRequest).not.toHaveBeenCalled();
  });
});
