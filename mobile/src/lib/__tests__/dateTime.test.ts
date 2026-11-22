import { formatClock, formatListTime, formatNewsDate } from '../dateTime';

// Локальное время: даты собираются из частей, чтобы тест не зависел от часового пояса.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const now = at(2026, 11, 22, 15, 30);

describe('formatListTime', () => {
  it('сегодня — время', () => {
    expect(formatListTime(at(2026, 11, 22, 14, 5).toISOString(), now)).toBe('14:05');
    expect(formatListTime(at(2026, 11, 22, 0, 1).toISOString(), now)).toBe('00:01');
  });

  it('вчера — «Вчера», даже если прошло меньше суток', () => {
    expect(formatListTime(at(2026, 11, 21, 23, 59).toISOString(), at(2026, 11, 22, 0, 5))).toBe('Вчера');
  });

  it('раньше — «22.11», в том числе на стыке года', () => {
    expect(formatListTime(at(2026, 11, 20).toISOString(), now)).toBe('20.11');
    expect(formatListTime(at(2025, 12, 31).toISOString(), at(2026, 1, 1, 10))).toBe('Вчера');
    expect(formatListTime(at(2025, 12, 30).toISOString(), at(2026, 1, 1, 10))).toBe('30.12');
  });

  it('неверная дата — пустая строка', () => {
    expect(formatListTime('не дата', now)).toBe('');
    expect(formatClock('не дата')).toBe('');
  });
});

describe('formatNewsDate', () => {
  it('текущий год без года, прошлые — с годом', () => {
    expect(formatNewsDate(at(2026, 11, 22).toISOString(), now)).toBe('22 ноября');
    expect(formatNewsDate(at(2025, 3, 5).toISOString(), now)).toBe('5 марта 2025');
    expect(formatNewsDate(at(2026, 1, 9).toISOString(), now)).toBe('9 января');
  });

  it('неверная дата — пустая строка', () => {
    expect(formatNewsDate('', now)).toBe('');
  });
});
