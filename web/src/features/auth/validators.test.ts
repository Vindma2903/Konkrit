import { describe, expect, it } from 'vitest';
import {
  formatPhone,
  isEmail,
  isFullName,
  isPhone,
  nationalDigits,
  nextPhoneValue,
  passwordOk,
  passwordRules,
  safeNext,
  toE164,
} from './validators';

describe('почта и имя', () => {
  it('проверяет адрес', () => {
    expect(isEmail('a@b.ru')).toBe(true);
    expect(isEmail(' a@b.ru ')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('a b@c.ru')).toBe(false);
  });

  it('имя — не меньше двух слов', () => {
    expect(isFullName('Анна Соколова')).toBe(true);
    expect(isFullName('Анна')).toBe(false);
    expect(isFullName('А Б')).toBe(false);
  });
});

describe('телефон', () => {
  it('убирает код страны: 8, 7, +7', () => {
    expect(nationalDigits('89001234567')).toBe('9001234567');
    expect(nationalDigits('+7 900 123-45-67')).toBe('9001234567');
    expect(nationalDigits('9001234567')).toBe('9001234567');
    // 10 цифр — номер без кода, даже если код города начинается на 8 или 7
    expect(nationalDigits('8122345678')).toBe('8122345678');
    expect(nationalDigits('7122345678')).toBe('7122345678');
  });

  it('форматирует по мере ввода', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('900')).toBe('+7 900');
    expect(formatPhone('9001234')).toBe('+7 900 123-4');
    expect(formatPhone('9001234567')).toBe('+7 900 123-45-67');
  });

  it('требует 10 цифр и отдаёт E.164', () => {
    expect(isPhone('+7 900 123-45-67')).toBe(true);
    expect(isPhone('+7 900 123')).toBe(false);
    expect(toE164('8 (900) 123-45-67')).toBe('+79001234567');
  });

  it('отбрасывает буквы при вводе', () => {
    expect(nextPhoneValue('+7 900', '+7 900a')).toBe('+7 900');
  });

  it('стирание разделителя убирает последнюю цифру', () => {
    expect(nextPhoneValue('+7 900 123-', '+7 900 123')).toBe('+7 900 12');
  });
});

describe('пароль', () => {
  it('считает требования', () => {
    expect(passwordRules('abc')).toEqual({ length: false, letters: false, digit: false });
    expect(passwordRules('Abcdefg1')).toEqual({ length: true, letters: true, digit: true });
    expect(passwordRules('abcdefg1').letters).toBe(false);
    expect(passwordRules('Пароль123').letters).toBe(true);
  });

  it('passwordOk требует всё сразу', () => {
    expect(passwordOk('Password1')).toBe(true);
    expect(passwordOk('password1')).toBe(false);
    expect(passwordOk('Pass1')).toBe(false);
  });
});

describe('safeNext', () => {
  it('пропускает только внутренние пути', () => {
    expect(safeNext('/requests?a=1')).toBe('/requests?a=1');
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext('/\\evil.example')).toBeNull();
    expect(safeNext('/a\nb')).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(['/a'])).toBeNull();
  });
});
