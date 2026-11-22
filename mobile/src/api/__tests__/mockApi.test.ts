import { createMockApi, MOCK_CODE } from '../mockApi';
import { ApiError } from '../types';

describe('mockApi', () => {
  it('принимает тестовый код и сообщает, что привязки ещё нет', async () => {
    const api = createMockApi({ delayMs: 0 });
    const result = await api.verifyCode({ channel: 'phone', value: '+79990000000', code: MOCK_CODE });
    expect(result.hasResidency).toBe(false);
    expect(result.user.phone).toBe('+79990000000');
  });

  it('отклоняет неверный код с кодом ошибки invalid_code', async () => {
    const api = createMockApi({ delayMs: 0 });
    await expect(
      api.verifyCode({ channel: 'email', value: 'a@b.ru', code: '000000' }),
    ).rejects.toMatchObject({ code: 'invalid_code' });
    await expect(
      api.verifyCode({ channel: 'email', value: 'a@b.ru', code: '000000' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('ищет дома по подстроке адреса', async () => {
    const api = createMockApi({ delayMs: 0 });
    const found = await api.searchHouses({ query: 'образцовая' });
    expect(found.length).toBe(2);
    expect(await api.searchHouses({ query: 'нет такого' })).toEqual([]);
  });

  it('после привязки квартира появляется в списке привязок', async () => {
    const api = createMockApi({ delayMs: 0 });
    const result = await api.submitResidency({
      houseId: 'house-1',
      apartment: '12',
      account: '123456',
      role: 'owner',
      verification: 'receipt',
    });
    expect(result.status).toBe('pending');
    const list = await api.getResidencies();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ apartment: '12', address: 'г. Оренбург, ул. Тестовая, д. 1' });
  });
});
