import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createMockApi, setApi, type ApiClient } from '@/api';
import { renderWithProviders } from '@/test/utils';

import { ChooseHomeScreen } from '../ChooseHomeScreen';
import { useOnboardingStore } from '../onboardingStore';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  Redirect: jest.fn(() => null),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

const next = () => screen.getByRole('button', { name: 'Продолжить' });

describe('ChooseHomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useOnboardingStore.getState().reset();
  });

  it('показывает найденные дома и счётчик, «Продолжить» неактивна', async () => {
    setApi(fakeApi());
    await renderWithProviders(<ChooseHomeScreen />);

    expect(await screen.findByTestId('houses-count')).toHaveTextContent('Найдено: 3');
    expect(screen.getByText('ЖК «Тестовый»')).toBeOnTheScreen();
    expect(screen.getAllByText('УК «Тест-Сервис»')).toHaveLength(2);
    expect(next()).toBeDisabled();
  });

  it('выбор карточки включает «Продолжить» и ведёт на привязку квартиры', async () => {
    setApi(fakeApi());
    await renderWithProviders(<ChooseHomeScreen />);

    await fireEvent.press(await screen.findByTestId('house-house-1'));
    expect(next()).toBeEnabled();
    expect(screen.getByTestId('house-house-1')).toBeSelected();

    await fireEvent.press(next());
    expect(router.push).toHaveBeenCalledWith('/apartment');
    expect(useOnboardingStore.getState().house?.id).toBe('house-1');
  });

  it('выбор другой карточки снимает предыдущий', async () => {
    setApi(fakeApi());
    await renderWithProviders(<ChooseHomeScreen />);

    await fireEvent.press(await screen.findByTestId('house-house-1'));
    await fireEvent.press(screen.getByTestId('house-house-2'));

    expect(screen.getByTestId('house-house-1')).not.toBeSelected();
    expect(screen.getByTestId('house-house-2')).toBeSelected();
  });

  it('поиск запускается после паузы, пустой результат объясняется', async () => {
    const searchHouses = jest.fn(createMockApi({ delayMs: 0 }).searchHouses);
    setApi(fakeApi({ searchHouses }));
    await renderWithProviders(<ChooseHomeScreen />);
    await screen.findByTestId('houses-count');
    searchHouses.mockClear();

    await fireEvent.changeText(screen.getByTestId('house-search'), 'нет такого');
    // Сразу после ввода запрос ещё не ушёл.
    expect(searchHouses).not.toHaveBeenCalled();

    await waitFor(() => expect(searchHouses).toHaveBeenCalledWith({ query: 'нет такого' }));
    expect(await screen.findByTestId('houses-empty')).toBeOnTheScreen();
    expect(screen.getByTestId('houses-count')).toHaveTextContent('Найдено: 0');
  });

  it('при ошибке загрузки показывает «Повторить», который перезапрашивает список', async () => {
    const searchHouses = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue([
        { id: 'house-1', title: 'ЖК «Тестовый»', address: 'ул. Тестовая, д. 1', company: '«Тест»' },
      ]);
    setApi(fakeApi({ searchHouses }));
    await renderWithProviders(<ChooseHomeScreen />);

    expect(
      await screen.findByText('Не удалось загрузить список домов. Проверьте соединение.'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('ЖК «Тестовый»')).toBeOnTheScreen();
  });
});
