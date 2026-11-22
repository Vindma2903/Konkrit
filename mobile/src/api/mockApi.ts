import { categories, classifyCategory } from './categories';
import {
  ApiError,
  type ApiClient,
  type CreateRequestInput,
  type House,
  type Residency,
  type SubmitResidencyInput,
  type UploadAttachmentInput,
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
  /** Каждая N-я загрузка вложения падает (чтобы вручную увидеть состояние S7c). */
  failUploadEvery?: number;
};

/** Мок-реализация ApiClient: данные в памяти, без сети. */
export function createMockApi({ delayMs = 400, failUploadEvery }: MockApiOptions = {}): ApiClient {
  const residencies: Residency[] = [];
  let counter = 0;
  let uploads = 0;
  let requests = 0;
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
        primary: residencies.length === 0,
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
      if (signal?.aborted) throw new ApiError('aborted');
      return classifyCategory(text);
    },

    async createRequest(input: CreateRequestInput) {
      await wait(delayMs);
      requests += 1;
      return {
        id: nextId('request'),
        number: 1000 + requests,
        createdAt: new Date().toISOString(),
        status: 'new' as const,
        answerWithinMin: 15,
      };
    },

    async getCategories() {
      await wait(delayMs);
      return [...categories];
    },

    async uploadAttachment({ signal, onProgress }: UploadAttachmentInput) {
      uploads += 1;
      const fails = failUploadEvery !== undefined && uploads % failUploadEvery === 0;
      const steps = 10;
      const stepMs = delayMs === 0 ? 0 : 150;
      for (let step = 1; step <= steps; step += 1) {
        await wait(stepMs);
        if (signal?.aborted) throw new ApiError('aborted');
        if (fails && step === 5) throw new ApiError('network');
        onProgress?.(step / steps);
      }
      return { id: nextId('attachment') };
    },
  };
}
