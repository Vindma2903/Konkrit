import * as SecureStore from 'expo-secure-store';

import { useSessionStore } from '../sessionStore';

jest.mock('expo-secure-store', () => {
  const data = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => data.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
});

const session = {
  tokens: { accessToken: 'a', refreshToken: 'r' },
  user: { id: 'user-1', phone: '+79990000000' },
  hasResidency: false,
};

describe('sessionStore', () => {
  beforeEach(async () => {
    await useSessionStore.getState().signOut();
    useSessionStore.setState({ hydrated: false });
  });

  it('сохраняет сессию в защищённом хранилище и восстанавливает при запуске', async () => {
    await useSessionStore.getState().signIn(session);
    expect(SecureStore.setItemAsync).toHaveBeenCalled();

    useSessionStore.setState({ tokens: null, user: null, hasResidency: false });
    await useSessionStore.getState().hydrate();

    const state = useSessionStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.tokens?.accessToken).toBe('a');
    expect(state.user?.id).toBe('user-1');
  });

  it('запускается без сессии, если хранилище пусто', async () => {
    await useSessionStore.getState().hydrate();
    const state = useSessionStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.tokens).toBeNull();
  });

  it('помечает наличие привязки и сохраняет это', async () => {
    await useSessionStore.getState().signIn(session);
    await useSessionStore.getState().markResidency();
    useSessionStore.setState({ tokens: null, user: null, hasResidency: false });
    await useSessionStore.getState().hydrate();
    expect(useSessionStore.getState().hasResidency).toBe(true);
  });

  it('выход очищает сессию', async () => {
    await useSessionStore.getState().signIn(session);
    await useSessionStore.getState().signOut();
    expect(useSessionStore.getState().tokens).toBeNull();
    expect(await SecureStore.getItemAsync('konkrit.access')).toBeNull();
    expect(await SecureStore.getItemAsync('konkrit.refresh')).toBeNull();
    expect(await SecureStore.getItemAsync('konkrit.profile')).toBeNull();
  });
});
