/** Случайный ключ для идемпотентных запросов (сообщения, заявки): уникален в пределах приложения. */
export function newClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
