import * as SecureStore from 'expo-secure-store';

import { useOnboardingStore } from '@/features/onboarding/onboardingStore';
import { useRequestDraft } from '@/features/requests/draftStore';
import { queryClient } from '@/lib/queryClient';

import { useLoginDraft } from '../loginDraftStore';
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
  user: { id: 'user-1' },
  hasResidency: true,
};

describe('сессия: чужие данные и повреждённое хранилище', () => {
  beforeEach(async () => {
    await useSessionStore.getState().signOut();
    useSessionStore.setState({ hydrated: false });
  });

  it('выход стирает черновики, онбординг, введённое на входе и кэш запросов', async () => {
    await useSessionStore.getState().signIn(session);
    useRequestDraft.getState().setDescription('Нет отопления');
    useRequestDraft.getState().setCategory({ id: 'heating', name: 'Отопление' });
    useOnboardingStore
      .getState()
      .selectHouse({ id: 'h1', title: 'A', address: 'ул. А', company: 'Б' });
    useOnboardingStore.getState().setField('apartment', '12');
    useLoginDraft.getState().setPhone('+7 (999) 123-45-67');
    queryClient.setQueryData(['residencies'], [{ id: 'residency-1' }]);

    await useSessionStore.getState().signOut();

    expect(useRequestDraft.getState()).toMatchObject({ description: '', category: null });
    expect(useOnboardingStore.getState()).toMatchObject({ house: null, apartment: '' });
    expect(useLoginDraft.getState().phone).toBe('');
    expect(queryClient.getQueryData(['residencies'])).toBeUndefined();
    expect(useSessionStore.getState().tokens).toBeNull();
  });

  it('запись без токенов в хранилище не считается входом', async () => {
    await SecureStore.setItemAsync(
      'konkrit.profile',
      JSON.stringify({ user: { id: 'u' }, hasResidency: true }),
    );
    await useSessionStore.getState().hydrate();
    const state = useSessionStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.tokens).toBeNull();
    expect(await SecureStore.getItemAsync('konkrit.profile')).toBeNull();
  });

  it('запись с пустым токеном тоже отбрасывается', async () => {
    await SecureStore.setItemAsync('konkrit.access', '');
    await SecureStore.setItemAsync('konkrit.refresh', 'r');
    await SecureStore.setItemAsync(
      'konkrit.profile',
      JSON.stringify({ user: { id: 'u' }, hasResidency: false }),
    );
    await useSessionStore.getState().hydrate();
    expect(useSessionStore.getState().tokens).toBeNull();
  });

  it('неразборный JSON не ломает запуск', async () => {
    await SecureStore.setItemAsync('konkrit.access', 'a');
    await SecureStore.setItemAsync('konkrit.refresh', 'r');
    await SecureStore.setItemAsync('konkrit.profile', '{не json');
    await useSessionStore.getState().hydrate();
    expect(useSessionStore.getState().hydrated).toBe(true);
    expect(useSessionStore.getState().tokens).toBeNull();
  });

  it('если записать в хранилище не вышло, вход остаётся в памяти', async () => {
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('storage full'));
    await useSessionStore.getState().signIn(session);
    expect(useSessionStore.getState().tokens?.accessToken).toBe('a');
  });

  it('токены и профиль лежат в разных ключах, а токен хранится как есть', async () => {
    await useSessionStore.getState().signIn(session);
    expect(await SecureStore.getItemAsync('konkrit.access')).toBe('a');
    expect(await SecureStore.getItemAsync('konkrit.refresh')).toBe('r');
    expect(JSON.parse((await SecureStore.getItemAsync('konkrit.profile')) ?? '')).toEqual({
      user: { id: 'user-1' },
      hasResidency: true,
    });
  });
});
