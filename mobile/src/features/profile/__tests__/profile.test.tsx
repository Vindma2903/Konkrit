import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError, setApi, type ApiClient, type User } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { useSessionStore } from '@/features/auth/sessionStore';
import { queryClient } from '@/lib/queryClient';
import { renderWithProviders } from '@/test/utils';

import { addressLine, ProfileScreen } from '../ProfileScreen';
import { SectionScreen } from '../SectionScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

function api(overrides: Partial<ApiClient> = {}): ApiClient {
  return { ...createMockApi({ delayMs: 0 }), ...overrides };
}

function signIn(user: User = { id: 'user-1', phone: '+79001234567' }) {
  useSessionStore.setState({
    tokens: { accessToken: 'a', refreshToken: 'r' },
    user,
    hasResidency: true,
  });
}

async function withResidency(client: ApiClient) {
  await client.submitResidency({
    houseId: 'house-1',
    apartment: '12',
    account: '1',
    role: 'owner',
    verification: 'receipt',
  });
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
  signIn();
});

describe('вкладка «Профиль»', () => {
  it('имя и «адрес, кв. N» из профиля', async () => {
    setApi(await withResidency(api()));
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByTestId('profile-loading')).toHaveTextContent('Загружаем профиль…');

    expect(await screen.findByTestId('profile-name')).toHaveTextContent('Иван Петров');
    expect(screen.getByTestId('profile-address')).toHaveTextContent(
      'г. Оренбург, ул. Тестовая, д. 1, кв. 12',
    );
    expect(screen.getByRole('header', { name: 'Профиль' })).toBeOnTheScreen();
  });

  it('нет имени — вместо него телефон или почта, с которой вошёл житель', async () => {
    setApi(api({ getProfile: async () => ({ address: 'ул. Тестовая, 1', apartment: '5' }) }));
    await renderWithProviders(<ProfileScreen />);
    expect(await screen.findByTestId('profile-name')).toHaveTextContent('+79001234567');

    signIn({ id: 'user-1', email: 'ivan@example.ru' });
    queryClient.clear();
    await renderWithProviders(<ProfileScreen />);
    await waitFor(() => expect(screen.getByTestId('profile-name')).toHaveTextContent('ivan@example.ru'));
  });

  it('нет адреса — строки адреса нет', async () => {
    setApi(api({ getProfile: async () => ({ name: 'Иван Петров' }) }));
    await renderWithProviders(<ProfileScreen />);
    await screen.findByTestId('profile-name');
    expect(screen.queryByTestId('profile-address')).toBeNull();
  });

  it('addressLine: без квартиры только адрес, квартира без адреса не показывается', () => {
    expect(addressLine({ address: 'ул. А, 1', apartment: '7' })).toBe('ул. А, 1, кв. 7');
    expect(addressLine({ address: 'ул. А, 1' })).toBe('ул. А, 1');
    expect(addressLine({ apartment: '7' })).toBeNull();
    expect(addressLine(undefined)).toBeNull();
  });

  it('ошибка: сообщение и «Повторить», меню и «Выйти» остаются доступны', async () => {
    const real = createMockApi({ delayMs: 0 });
    const getProfile = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation(real.getProfile);
    setApi(api({ getProfile }));
    await renderWithProviders(<ProfileScreen />);

    expect(await screen.findByText('Не удалось загрузить профиль')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-section-payment')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-sign-out')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('profile-retry'));
    expect(await screen.findByTestId('profile-name')).toHaveTextContent('Иван Петров');
    expect(screen.queryByText('Не удалось загрузить профиль')).toBeNull();
  });

  it('пять пунктов меню по макету, у каждого роль кнопки и название раздела', async () => {
    setApi(api());
    await renderWithProviders(<ProfileScreen />);
    await screen.findByTestId('profile-name');
    for (const title of ['Мои адреса', 'Уведомления', 'Документы и акты', 'Оплата', 'Помощь']) {
      expect(screen.getByRole('button', { name: title })).toBeOnTheScreen();
    }
  });

  it('пункт открывает раздел по ключу', async () => {
    setApi(api());
    await renderWithProviders(<ProfileScreen />);
    await screen.findByTestId('profile-name');

    await fireEvent.press(screen.getByRole('button', { name: 'Оплата' }));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/profile/[section]',
      params: { section: 'payment' },
    });
  });

  it('«Выйти» закрывает сессию без подтверждения и стирает кэш', async () => {
    setApi(api());
    await renderWithProviders(<ProfileScreen />);
    await screen.findByTestId('profile-name');
    expect(queryClient.getQueryData(['profile', 'user-1'])).toBeDefined();

    await fireEvent.press(screen.getByTestId('profile-sign-out'));

    await waitFor(() => expect(useSessionStore.getState().tokens).toBeNull());
    expect(queryClient.getQueryData(['profile', 'user-1'])).toBeUndefined();
  });

  it('другой житель на этом устройстве не видит профиль прежнего', async () => {
    const names: Record<string, string> = { 'user-1': 'Первый Житель', 'user-2': 'Второй Житель' };
    let current = 'user-1';
    setApi(api({ getProfile: async () => ({ name: names[current] }) }));
    await renderWithProviders(<ProfileScreen />);
    expect(await screen.findByTestId('profile-name')).toHaveTextContent('Первый Житель');

    // Житель сменился без выхода и без очистки кэша: профиль определяется ключом с идентификатором
    current = 'user-2';
    await act(async () => signIn({ id: 'user-2', phone: '+79007654321' }));

    expect(await screen.findByText('Второй Житель')).toBeOnTheScreen();
    expect(screen.queryByText('Первый Житель')).toBeNull();
    expect(queryClient.getQueryData(['profile', 'user-1'])).toEqual({ name: 'Первый Житель' });
  });
});

describe('раздел профиля', () => {
  const open = (section: string) => jest.mocked(useLocalSearchParams).mockReturnValue({ section });

  it('название раздела и «Раздел появится в следующих версиях»', async () => {
    open('payment');
    await renderWithProviders(<SectionScreen />);
    expect(screen.getByRole('header', { name: 'Оплата' })).toBeOnTheScreen();
    expect(screen.getByTestId('section-stub')).toHaveTextContent('Раздел появится в следующих версиях');
  });

  it('«Назад» возвращает в профиль', async () => {
    open('help');
    await renderWithProviders(<SectionScreen />);
    await fireEvent.press(screen.getByTestId('header-back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('неизвестный раздел получает общее название', async () => {
    open('unknown');
    await renderWithProviders(<SectionScreen />);
    expect(screen.getByRole('header', { name: 'Раздел' })).toBeOnTheScreen();
  });
});
