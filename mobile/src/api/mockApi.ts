import { categories, classifyCategory } from './categories';
import { createMockCommunity } from './mockCommunity';
import { createMockRequests, deriveTitle, type UploadedFile } from './mockRequests';
import {
  ApiError,
  type ApiClient,
  type CreateRequestInput,
  type CreateRequestResult,
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
  /** Размер страницы списка заявок (в тестах уменьшают, чтобы проверить дозагрузку). */
  pageSize?: number;
  /** Задержка ответа, мс. В тестах — 0. */
  delayMs?: number;
  /** Каждая N-я загрузка вложения падает (чтобы вручную увидеть состояние S7c). */
  failUploadEvery?: number;
};

/** Мок-реализация ApiClient: данные в памяти, без сети. */
export function createMockApi({
  delayMs = 400,
  failUploadEvery,
  pageSize,
}: MockApiOptions = {}): ApiClient {
  const residencies: Residency[] = [];
  let counter = 0;
  let uploads = 0;
  let requests = 0;
  const created = new Map<string, CreateRequestResult>();
  const uploaded = new Map<string, UploadedFile>();
  const requestsStore = createMockRequests({ pageSize });
  const community = createMockCommunity({ pageSize });
  const lookupUpload = (id: string) => uploaded.get(id);
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
      // Повтор с тем же ключом возвращает ту же заявку, а не создаёт новую.
      const existing = created.get(input.clientRequestId);
      if (existing) return existing;
      requests += 1;
      const result: CreateRequestResult = {
        id: nextId('request'),
        number: 1000 + requests,
        createdAt: new Date().toISOString(),
        status: 'new' as const,
        answerWithinMin: 15,
      };
      created.set(input.clientRequestId, result);
      const residency = residencies.find((item) => item.id === input.residencyId);
      requestsStore.add(
        {
          id: result.id,
          number: result.number,
          createdAt: result.createdAt,
          title: deriveTitle(input.description),
          categoryName: categories.find((item) => item.id === input.categoryId)?.name ?? 'Другое',
          status: 'new',
          executor: null,
          curator: null,
          address: residency ? `${residency.address}, кв. ${residency.apartment}` : '',
        },
        input.attachmentIds.flatMap((attachmentId) => {
          const file = uploaded.get(attachmentId);
          return file
            ? [
                {
                  id: attachmentId,
                  kind: file.mimeType?.startsWith('video/')
                    ? ('video' as const)
                    : file.mimeType?.startsWith('image/')
                      ? ('image' as const)
                      : ('document' as const),
                  name: file.name,
                  url: file.uri,
                  size: file.size,
                },
              ]
            : [];
        }),
      );
      return result;
    },

    async getCategories() {
      await wait(delayMs);
      return [...categories];
    },

    async uploadAttachment({ file, signal, onProgress }: UploadAttachmentInput) {
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
      const id = nextId('attachment');
      uploaded.set(id, file);
      return { id };
    },

    async listRequests(input) {
      await wait(delayMs);
      return requestsStore.list(input);
    },

    async getRequest(id) {
      await wait(delayMs);
      return requestsStore.get(id);
    },

    async listMessages(id) {
      await wait(delayMs);
      return requestsStore.messages(id);
    },

    async sendMessage(id, input) {
      await wait(delayMs);
      return requestsStore.send(id, input, lookupUpload);
    },

    async listHistory(id) {
      await wait(delayMs);
      return requestsStore.history(id);
    },

    async listFiles(id) {
      await wait(delayMs);
      return requestsStore.files(id);
    },

    async listConversations() {
      await wait(delayMs);
      return community.conversations();
    },

    async getConversation(id) {
      await wait(delayMs);
      return community.conversation(id);
    },

    async listChatMessages(id) {
      await wait(delayMs);
      return community.messages(id);
    },

    async sendChatMessage(id, input) {
      await wait(delayMs);
      return community.send(id, input, lookupUpload);
    },

    async markChatRead(id) {
      await wait(delayMs);
      community.markRead(id);
    },

    async listNews(input) {
      await wait(delayMs);
      return community.news(input);
    },

    async getNews(id) {
      await wait(delayMs);
      return community.newsItem(id);
    },

    async getProfile() {
      await wait(delayMs);
      const primary = residencies.find((item) => item.primary) ?? residencies[0];
      return {
        name: 'Иван Петров',
        address: primary?.address,
        apartment: primary?.apartment,
      };
    },
  };
}
