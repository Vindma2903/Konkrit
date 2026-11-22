import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { setApi, type ApiClient, type CreateRequestResult } from '@/api';
import { createMockApi } from '@/api/mockApi';
import { useSessionStore } from '@/features/auth/sessionStore';
import { renderWithProviders } from '@/test/utils';

import { flushDraftWrites, useRequestDraft } from '../draftStore';
import { NewRequestScreen } from '../NewRequestScreen';
import { discardDraft } from '../uploader';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  Redirect: jest.fn(() => null),
  useLocalSearchParams: jest.fn(() => ({})),
  usePreventRemove: jest.fn(() => jest.fn()),
}));

const residency = {
  id: 'residency-1',
  houseId: 'house-1',
  address: 'г. Оренбург, ул. Тестовая, д. 1',
  apartment: '12',
  status: 'confirmed' as const,
  primary: true,
};

const created: CreateRequestResult = {
  id: 'request-1',
  number: 1001,
  createdAt: '2026-11-22T10:00:00.000Z',
  status: 'new',
  answerWithinMin: 15,
};

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    ...createMockApi({ delayMs: 0 }),
    getResidencies: jest.fn().mockResolvedValue([residency]),
    ...overrides,
  };
}

const signIn = (id: string) =>
  useSessionStore.setState({
    tokens: { accessToken: 'a', refreshToken: 'r' },
    user: { id },
    hasResidency: true,
  });

const submit = () => screen.getByTestId('request-submit');

beforeEach(async () => {
  jest.clearAllMocks();
  await discardDraft();
  await AsyncStorage.clear();
  signIn('user-1');
});

describe('владелец черновика', () => {
  it('чужой черновик стирается при открытии формы другим жителем', async () => {
    setApi(fakeApi());
    useRequestDraft.setState({
      category: { id: 'heating', name: 'Отопление' },
      description: 'Нет отопления у соседа',
      ownerId: 'user-A',
    });
    signIn('user-B');

    await renderWithProviders(<NewRequestScreen />);

    await waitFor(() => expect(useRequestDraft.getState().description).toBe(''));
    expect(useRequestDraft.getState().ownerId).toBe('user-B');
  });

  it('свой черновик сохраняется', async () => {
    setApi(fakeApi());
    useRequestDraft.setState({ description: 'Нет отопления', ownerId: 'user-1' });

    await renderWithProviders(<NewRequestScreen />);

    expect(useRequestDraft.getState().description).toBe('Нет отопления');
  });

  it('у черновика без владельца он появляется при открытии формы', async () => {
    setApi(fakeApi());
    useRequestDraft.setState({ description: 'Нет отопления', ownerId: null });

    await renderWithProviders(<NewRequestScreen />);

    await waitFor(() => expect(useRequestDraft.getState().ownerId).toBe('user-1'));
    await flushDraftWrites();
    const saved = JSON.parse((await AsyncStorage.getItem('konkrit.requestDraft')) ?? '{}') as {
      state: { ownerId: string };
    };
    expect(saved.state.ownerId).toBe('user-1');
  });

  it('выход из аккаунта дожидается удаления черновика с диска', async () => {
    useRequestDraft.setState({ description: 'Нет отопления', ownerId: 'user-1' });
    await flushDraftWrites();
    expect(await AsyncStorage.getItem('konkrit.requestDraft')).not.toBeNull();

    await useSessionStore.getState().signOut();

    expect(await AsyncStorage.getItem('konkrit.requestDraft')).toBeNull();
  });
});

describe('защита от дубля заявки', () => {
  function fillValid() {
    useRequestDraft.setState({
      category: { id: 'heating', name: 'Отопление' },
      description: 'Нет отопления во всей квартире с утра',
    });
  }

  it('повтор после ошибки уходит с тем же ключом, новая заявка после успеха — с новым', async () => {
    const createRequest = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(created);
    setApi(fakeApi({ createRequest }));
    fillValid();
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');

    await fireEvent.press(submit());
    await waitFor(() => expect(createRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    await fireEvent.press(submit());
    await waitFor(() => expect(createRequest).toHaveBeenCalledTimes(2));

    const keys = createRequest.mock.calls.map(([input]) => input.clientRequestId as string);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);

    await waitFor(() => expect(useRequestDraft.getState().requestKey).toBeNull());
    fillValid();
    expect(useRequestDraft.getState().ensureRequestKey()).not.toBe(keys[0]);
  });
});

describe('выход из аккаунта во время отправки', () => {
  it('итог чужой заявки не показывается и экран успеха не открывается', async () => {
    let finish: (value: CreateRequestResult) => void = () => undefined;
    const createRequest = jest.fn(
      () => new Promise<CreateRequestResult>((resolve) => (finish = resolve)),
    );
    setApi(fakeApi({ createRequest }));
    useRequestDraft.setState({
      category: { id: 'heating', name: 'Отопление' },
      description: 'Нет отопления во всей квартире с утра',
    });
    await renderWithProviders(<NewRequestScreen />);
    await screen.findByText('г. Оренбург, ул. Тестовая, д. 1, кв. 12');
    await fireEvent.press(submit());
    await screen.findByText('Отправляем…');

    await useSessionStore.getState().signOut();
    finish(created);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(router.replace).not.toHaveBeenCalled();
  });
});
