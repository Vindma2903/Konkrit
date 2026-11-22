import { ApiError } from '@/api';

const SEND_FAILED = 'Не удалось отправить код. Проверьте соединение и попробуйте снова';

/** Ошибка выдачи кода: отдельный текст, если сервер просит подождать. */
export function sendCodeErrorText(error: unknown): string {
  if (error instanceof ApiError && error.code === 'rate_limited') {
    return error.retryAfterSec
      ? `Слишком много попыток. Повторите через ${error.retryAfterSec} с`
      : 'Слишком много попыток. Повторите чуть позже';
  }
  return SEND_FAILED;
}

export function isInvalidCode(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'invalid_code';
}

export function verifyCodeErrorText(error: unknown): string {
  return isInvalidCode(error)
    ? 'Неверный код. Проверьте и попробуйте ещё раз'
    : 'Не удалось проверить код. Проверьте соединение и попробуйте снова';
}
