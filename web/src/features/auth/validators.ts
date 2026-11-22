const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

/** Имя и фамилия: не меньше двух слов, каждое не короче двух символов. */
export function isFullName(value: string): boolean {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.every((word) => word.length >= 2);
}

/** Цифры российского номера без кода страны: до 10 штук. */
export function nationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  // Код страны срезаем у номера с «+» или из 11 цифр; 10 цифр — это уже номер без кода (812…, 800…)
  const hasCountryCode = raw.trim().startsWith('+') || digits.length >= 11;
  if (hasCountryCode && (digits[0] === '7' || digits[0] === '8')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** «+7 900 000-00-00» по мере ввода. */
export function formatPhone(digits: string): string {
  if (!digits) return '';
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)];
  let text = `+7 ${parts[0]}`;
  if (parts[1]) text += ` ${parts[1]}`;
  if (parts[2]) text += `-${parts[2]}`;
  if (parts[3]) text += `-${parts[3]}`;
  return text;
}

/**
 * Следующее значение поля телефона. Если пользователь стёр только разделитель,
 * удаляем последнюю цифру, иначе форматирование вернуло бы разделитель обратно.
 */
export function nextPhoneValue(previous: string, raw: string): string {
  let digits = nationalDigits(raw);
  if (raw.length < previous.length && digits === nationalDigits(previous)) digits = digits.slice(0, -1);
  return formatPhone(digits);
}

export function isPhone(value: string): boolean {
  return nationalDigits(value).length === 10;
}

/** Телефон для отправки: +7XXXXXXXXXX. */
export function toE164(value: string): string {
  return `+7${nationalDigits(value)}`;
}

export type PasswordRules = { length: boolean; letters: boolean; digit: boolean };

export function passwordRules(password: string): PasswordRules {
  return {
    length: password.length >= 8,
    letters: /\p{Ll}/u.test(password) && /\p{Lu}/u.test(password),
    digit: /\d/.test(password),
  };
}

export function passwordOk(password: string): boolean {
  const rules = passwordRules(password);
  return rules.length && rules.letters && rules.digit;
}

/** Путь возврата после входа: только внутренний адрес. */
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(value)) return null;
  return value;
}

export function minutesLabel(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}
