import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import TabsLayout from '@/app/(tabs)/_layout';
import ChatTab from '@/app/(tabs)/chat';
import Home from '@/app/(tabs)/home';
import Profile from '@/app/(tabs)/profile';
import Requests from '@/app/(tabs)/requests';
import Services from '@/app/(tabs)/services';
import { useSessionStore } from '@/features/auth/sessionStore';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/home': Home,
  '(tabs)/requests': Requests,
  '(tabs)/services': Services,
  '(tabs)/chat': ChatTab,
  '(tabs)/profile': Profile,
};

describe('нижняя навигация', () => {
  it('пять вкладок в порядке макета, открыта «Новости»', async () => {
    await renderRouter(routes, { initialUrl: '/home' });

    const order = [
      ['home', 'Новости'],
      ['requests', 'Заявки'],
      ['services', 'Услуги'],
      ['chat', 'Чат'],
      ['profile', 'Профиль'],
    ] as const;
    for (const [id, title] of order) {
      expect(screen.getByTestId(`tab-${id}`)).toHaveAccessibleName(title);
    }
    expect(screen.getByTestId('tab-home')).toBeSelected();
    expect(screen.getByTestId('tab-requests')).not.toBeSelected();
  });

  it('переключение вкладки открывает раздел и подсвечивает вкладку', async () => {
    await renderRouter(routes, { initialUrl: '/home' });

    await fireEvent.press(screen.getByTestId('tab-services'));

    expect(screen.getByTestId('tab-services')).toBeSelected();
    expect(screen.getByRole('header', { name: 'Услуги' })).toBeOnTheScreen();
    expect(screen.getByText('Раздел появится в следующих версиях')).toBeOnTheScreen();
  });

  it('«Выйти» в профиле закрывает сессию', async () => {
    useSessionStore.setState({
      tokens: { accessToken: 'a', refreshToken: 'r' },
      user: { id: 'user-1' },
      hasResidency: true,
    });
    await renderRouter(routes, { initialUrl: '/profile' });

    await fireEvent.press(screen.getByTestId('profile-sign-out'));

    expect(useSessionStore.getState().tokens).toBeNull();
  });
});
