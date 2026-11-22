/** Российский мобильный номер: +7 (999) 123-45-67. Внутри хранится 10 цифр без кода страны. */

const NATIONAL_LENGTH = 10;

/** Достаёт 10 национальных цифр из того, что ввёл или вставил пользователь. */
export function toNational(text: string): string {
  let digits = text.replace(/\D/g, '');
  if (text.trim().startsWith('+7')) {
    // Код страны из маски поля или из вставки «+7…».
    digits = digits.slice(1);
  } else if (digits[0] === '7' || digits[0] === '8') {
    // «8 999…» и «7 999…»: мобильные номера РФ начинаются с 9, так что ведущие 7 и 8 — это код страны.
    digits = digits.slice(1);
  }
  return digits.slice(0, NATIONAL_LENGTH);
}

/** Маска для поля: пустая строка, пока цифр нет. */
export function formatPhone(text: string): string {
  const d = toNational(text);
  if (d.length === 0) return '';
  let out = `+7 (${d.slice(0, 3)}`;
  if (d.length > 3) out += ')';
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}

export function isValidPhone(text: string): boolean {
  return toNational(text).length === NATIONAL_LENGTH;
}

/** Формат для API: +7XXXXXXXXXX. */
export function toE164(text: string): string {
  return `+7${toNational(text)}`;
}
