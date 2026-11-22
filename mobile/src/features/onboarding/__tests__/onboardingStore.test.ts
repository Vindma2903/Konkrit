import type { House } from '@/api';

import { useOnboardingStore } from '../onboardingStore';

const first: House = { id: 'house-1', title: 'A', address: 'ул. А, 1', company: 'УК' };
const second: House = { id: 'house-2', title: 'B', address: 'ул. Б, 2', company: 'УК' };

describe('onboardingStore', () => {
  beforeEach(() => useOnboardingStore.getState().reset());

  it('повторный выбор того же дома сохраняет введённое', () => {
    const store = useOnboardingStore.getState();
    store.selectHouse(first);
    store.setField('apartment', '12');
    store.setField('role', 'tenant');

    useOnboardingStore.getState().selectHouse(first);

    expect(useOnboardingStore.getState().apartment).toBe('12');
    expect(useOnboardingStore.getState().role).toBe('tenant');
  });

  it('выбор другого дома очищает поля привязки', () => {
    const store = useOnboardingStore.getState();
    store.selectHouse(first);
    store.setField('apartment', '12');
    store.setField('account', '555');
    store.setField('verification', 'document');

    useOnboardingStore.getState().selectHouse(second);

    const state = useOnboardingStore.getState();
    expect(state.house?.id).toBe('house-2');
    expect(state).toMatchObject({
      apartment: '',
      account: '',
      role: 'owner',
      verification: 'receipt',
    });
  });
});
