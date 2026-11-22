import { describe, expect, it } from 'vitest';
import { formatDate, pendingLabel } from './format';

describe('формат', () => {
  it('склонение «заявок на доступ»', () => {
    expect(pendingLabel(1)).toBe('1 заявка на доступ');
    expect(pendingLabel(2)).toBe('2 заявки на доступ');
    expect(pendingLabel(5)).toBe('5 заявок на доступ');
    expect(pendingLabel(11)).toBe('11 заявок на доступ');
    expect(pendingLabel(21)).toBe('21 заявка на доступ');
    expect(pendingLabel(12)).toBe('12 заявок на доступ');
  });

  it('дата «22 ноября 2026»; неверная — пустая строка', () => {
    expect(formatDate(new Date(2026, 10, 22, 14, 5).toISOString())).toBe('22 ноября 2026');
    expect(formatDate('не дата')).toBe('');
  });
});
