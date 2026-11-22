import { render, screen } from '@testing-library/react-native';

import type { RequestStatus } from '@/api';

import {
  filledSteps,
  filterStatuses,
  filters,
  progressSteps,
  statusColors,
  statusLabels,
} from '../status';
import { StatusBadge } from '../StatusBadge';

describe('фильтры и статусы', () => {
  it('фильтры идут в порядке макета', () => {
    expect(filters.map((item) => item.label)).toEqual(['Все', 'Новые', 'В работе', 'Завершены']);
  });

  it('фильтр сопоставляется со статусами', () => {
    expect(filterStatuses('all')).toBeUndefined();
    expect(filterStatuses('new')).toEqual(['new']);
    expect(filterStatuses('in_progress')).toEqual(['in_progress', 'waiting']);
    expect(filterStatuses('completed')).toEqual(['completed', 'cancelled']);
  });

  it('шкала: закрашено до текущего статуса включительно', () => {
    expect(filledSteps('new')).toBe(1);
    expect(filledSteps('in_progress')).toBe(2);
    expect(filledSteps('waiting')).toBe(3);
    expect(filledSteps('completed')).toBe(4);
  });

  it('у отменённой заявки шкала серая', () => {
    expect(filledSteps('cancelled')).toBe(0);
  });

  it('сегменты шкалы названы как в макете', () => {
    expect(progressSteps.map((step) => step.label)).toEqual([
      'Новая',
      'В работе',
      'Ожидание',
      'Завершена',
    ]);
  });
});

describe('StatusBadge', () => {
  const cases: [RequestStatus, string, string, string][] = [
    ['new', 'Новая', '#E3EEFF', '#1F4E9E'],
    ['in_progress', 'В работе', '#FFF1D6', '#7A4B00'],
    ['waiting', 'Ожидание', '#E6E7E8', '#666A70'],
    ['completed', 'Завершена', '#DDF3E4', '#1E6B3A'],
    ['cancelled', 'Отменена', '#E6E7E8', '#666A70'],
  ];

  it.each(cases)('%s: подпись «%s» и цвета из макета', async (status, label, background, text) => {
    expect(statusLabels[status]).toBe(label);
    expect(statusColors[status]).toEqual({ background, text });
    await render(<StatusBadge status={status} testID="badge" />);
    expect(screen.getByText(label)).toBeOnTheScreen();
    expect(screen.getByTestId('badge')).toHaveStyle({ backgroundColor: background });
  });
});
