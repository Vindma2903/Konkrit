let provider: () => string | null = () => null;

/** Откуда клиент администрирования берёт access-токен (регистрирует хранилище сессии). */
export function setTokenProvider(next: () => string | null): void {
  provider = next;
}

export const currentToken = (): string | null => provider();
