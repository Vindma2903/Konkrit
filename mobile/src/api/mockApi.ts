import { classifyCategory } from './categories';
import {
  ApiError,
  type ApiClient,
  type CreateRequestInput,
  type House,
  type Residency,
  type SubmitResidencyInput,
} from './types';

/** Код, который принимает мок. Работает только в режиме разработки. */
export const MOCK_CODE = '123456';

const houses: readonly House[] = [
  {
    id: 'house-1',
    title: 'ЖК «Тестовый»',
    address: 'г. Оренбург, ул. Тестовая, д. 1',
    company: '«Тест-Сервис»',
  },
  {
    id: 'house-2',
    title: 'Дом на Образцовой',
    address: 'г. Оренбург, ул. Образцовая, д. 12',
    company: '«Тест-Сервис»',
  },
  {
    id: 'house-3',
    title: 'ЖК «Пример»',
    address: 'г. Оренбург, ул. Образцовая, д. 14, корп. 2',
    company: '«Образец»',
  },
];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type MockApiOptions = {
  /** Задержка ответа, мс. В тестах — 0. */
  delayMs?: number;
};

/** Мок-реализация ApiClient: данные в памяти, без сети. */
export function createMockApi({ delayMs = 400 }: MockApiOptions = {}): ApiClient {
  const residencies: Residency[] = [];
  let counter = 0;
  const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`;

  return {
    async requestCode() {
      await wait(delayMs);
      return { retryAfterSec: 60 };
    },

    async verifyCode({ channel, value, code }) {
      await wait(delayMs);
      if (code !== MOCK_CODE) throw new ApiError('invalid_code');
      return {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: { id: 'user-1', ...(channel === 'phone' ? { phone: value } : { email: value }) },
        hasResidency: residencies.length > 0,
      };
    },

    async searchHouses({ query }) {
      await wait(delayMs);
      const needle = query.trim().toLowerCase();
      if (!needle) return [...houses];
      return houses.filter((house) =>
        `${house.title} ${house.address}`.toLowerCase().includes(needle),
      );
    },

    async submitResidency(input: SubmitResidencyInput) {
      await wait(delayMs);
      const house = houses.find((item) => item.id === input.houseId);
      if (!house) throw new ApiError('unknown', 'Дом не найден');
      const residency: Residency = {
        id: nextId('residency'),
        houseId: house.id,
        address: house.address,
        apartment: input.apartment,
        // Мок сразу подтверждает привязку, чтобы можно было пройти сценарий заявки.
        status: 'confirmed',
      };
      residencies.push(residency);
      return { id: residency.id, status: 'pending' as const };
    },

    async getResidencies() {
      await wait(delayMs);
      return [...residencies];
    },

    async suggestCategory({ text, signal }) {
      await wait(delayMs);
      if (signal?.aborted) throw new ApiError('unknown', 'aborted');
      return classifyCategory(text);
    },

    async createRequest(input: CreateRequestInput) {
      await wait(delayMs);
      return { id: nextId('request') };
    },
  };
}
