import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Redirect, router } from 'expo-router';

import { createMockApi, setApi, type ApiClient, type House } from '@/api';
import { useSessionStore } from '@/features/auth/sessionStore';
import { renderWithProviders } from '@/test/utils';

import { ApartmentScreen } from '../ApartmentScreen';
import { useOnboardingStore } from '../onboardingStore';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  Redirect: jest.fn(() => null),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const house: House = {
  id: 'house-1',
  title: 'ЖК «Тестовый»',
  address: 'г. Оренбург, ул. Тестовая, д. 1',
  company: '«Тест-Сервис»',
};

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

const send = () => screen.getByRole('button', { name: 'Отправить на подтверждение' });

describe('ApartmentScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().selectHouse(house);
    await useSessionStore.getState().signOut();
    await useSessionStore.getState().signIn({
      tokens: { accessToken: 'a', refreshToken: 'r' },
      user: { id: 'user-1' },
      hasResidency: false,
    });
  });

  it('без выбранного дома возвращает к выбору дома', async () => {
    useOnboardingStore.getState().reset();
    setApi(fakeApi());
    await renderWithProviders(<ApartmentScreen />);
    expect(Redirect).toHaveBeenCalled();
    expect(jest.mocked(Redirect).mock.calls[0]?.[0]).toMatchObject({ href: '/choose-home' });
  });

  it('показывает дом и УК, по умолчанию «Собственник» и «По коду из квитанции»', async () => {
    setApi(fakeApi());
    await renderWithProviders(<ApartmentScreen />);
    expect(screen.getByText(house.address)).toBeOnTheScreen();
    expect(screen.getByText(`УК ${house.company}`)).toBeOnTheScreen();
    expect(screen.getByTestId('role-owner')).toBeSelected();
    expect(screen.getByTestId('verification-receipt')).toBeChecked();
    expect(send()).toBeDisabled();
  });

  it('квартира принимает только цифры', async () => {
    setApi(fakeApi());
    await renderWithProviders(<ApartmentScreen />);
    await fireEvent.changeText(screen.getByTestId('apartment-number'), '1a2б');
    expect(screen.getByTestId('apartment-number')).toHaveDisplayValue('12');
  });

  it('по коду из квитанции нужен лицевой счёт: ошибка после ухода с поля', async () => {
    setApi(fakeApi());
    await renderWithProviders(<ApartmentScreen />);

    await fireEvent.changeText(screen.getByTestId('apartment-number'), '12');
    expect(send()).toBeDisabled();
    expect(screen.queryByText('Введите номер лицевого счёта')).not.toBeOnTheScreen();

    await fireEvent(screen.getByTestId('apartment-account'), 'blur');
    expect(screen.getByText('Введите номер лицевого счёта')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('apartment-account'), '123456');
    expect(send()).toBeEnabled();
    expect(screen.queryByText('Введите номер лицевого счёта')).not.toBeOnTheScreen();
  });

  it('по документу лицевой счёт необязателен', async () => {
    setApi(fakeApi());
    await renderWithProviders(<ApartmentScreen />);

    await fireEvent.changeText(screen.getByTestId('apartment-number'), '12');
    await fireEvent.press(screen.getByTestId('verification-document'));

    expect(screen.getByText('Лицевой счёт (необязательно)')).toBeOnTheScreen();
    expect(send()).toBeEnabled();
  });

  it('отправляет привязку, отмечает её в сессии и открывает экран «отправлено»', async () => {
    const submitResidency = jest.fn().mockResolvedValue({ id: 'residency-1', status: 'pending' });
    setApi(fakeApi({ submitResidency }));
    await renderWithProviders(<ApartmentScreen />);

    await fireEvent.changeText(screen.getByTestId('apartment-number'), '12');
    await fireEvent.changeText(screen.getByTestId('apartment-account'), '123456');
    await fireEvent.press(screen.getByTestId('role-tenant'));
    await fireEvent.press(send());

    await waitFor(() =>
      expect(submitResidency).toHaveBeenCalledWith({
        houseId: 'house-1',
        apartment: '12',
        account: '123456',
        role: 'tenant',
        verification: 'receipt',
      }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/residency-sent'));
    expect(useSessionStore.getState().hasResidency).toBe(true);
  });

  it('по документу не отправляет лицевой счёт', async () => {
    const submitResidency = jest.fn().mockResolvedValue({ id: 'residency-1', status: 'pending' });
    setApi(fakeApi({ submitResidency }));
    await renderWithProviders(<ApartmentScreen />);

    await fireEvent.changeText(screen.getByTestId('apartment-number'), '12');
    await fireEvent.changeText(screen.getByTestId('apartment-account'), '123456');
    await fireEvent.press(screen.getByTestId('verification-document'));
    await fireEvent.press(send());

    await waitFor(() => expect(submitResidency).toHaveBeenCalled());
    expect(submitResidency.mock.calls[0]?.[0]).toMatchObject({
      verification: 'document',
      account: undefined,
    });
  });

  it('при ошибке сохраняет введённое и показывает сообщение', async () => {
    const submitResidency = jest.fn().mockRejectedValue(new Error('network'));
    setApi(fakeApi({ submitResidency }));
    await renderWithProviders(<ApartmentScreen />);

    await fireEvent.changeText(screen.getByTestId('apartment-number'), '12');
    await fireEvent.changeText(screen.getByTestId('apartment-account'), '123456');
    await fireEvent.press(send());

    expect(
      await screen.findByText(
        'Не удалось отправить данные. Проверьте соединение и попробуйте снова',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('apartment-number')).toHaveDisplayValue('12');
    expect(router.replace).not.toHaveBeenCalled();
    expect(send()).toBeEnabled();
  });
});
