import { formatPhone, isValidPhone, toE164, toNational } from '../phone';

describe('phone', () => {
  it('форматирует по мере ввода', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('9')).toBe('+7 (9');
    expect(formatPhone('999')).toBe('+7 (999');
    expect(formatPhone('9991')).toBe('+7 (999) 1');
    expect(formatPhone('9991234')).toBe('+7 (999) 123-4');
    expect(formatPhone('9991234567')).toBe('+7 (999) 123-45-67');
  });

  it('не застревает при стирании: «+7 (999» после «+7 (999) » остаётся стираемой', () => {
    expect(formatPhone('+7 (999) ')).toBe('+7 (999');
    expect(formatPhone('+7 (99')).toBe('+7 (99');
  });

  it('понимает 8, +7 и 7 в начале номера при вставке', () => {
    expect(toNational('89991234567')).toBe('9991234567');
    expect(toNational('+79991234567')).toBe('9991234567');
    expect(toNational('79991234567')).toBe('9991234567');
    expect(toNational('+7 (999) 123-45-67')).toBe('9991234567');
  });

  it('не берёт больше 10 цифр', () => {
    expect(toNational('+7 (999) 123-45-678')).toBe('9991234567');
  });

  it('проверяет длину', () => {
    expect(isValidPhone('+7 (999) 123-45-6')).toBe(false);
    expect(isValidPhone('+7 (999) 123-45-67')).toBe(true);
  });

  it('приводит к формату API', () => {
    expect(toE164('8 (999) 123-45-67')).toBe('+79991234567');
  });
});
