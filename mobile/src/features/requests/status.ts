import type { RequestStatus } from '@/api';

export const statusLabels: Record<RequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  waiting: 'Ожидание',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

/** Цвета плашки статуса: фон и текст. «Ожидание» и «Отменена» нейтральные (в макете их нет). */
export const statusColors: Record<RequestStatus, { background: string; text: string }> = {
  new: { background: '#E3EEFF', text: '#1F4E9E' },
  in_progress: { background: '#FFF1D6', text: '#7A4B00' },
  waiting: { background: '#E6E7E8', text: '#666A70' },
  completed: { background: '#DDF3E4', text: '#1E6B3A' },
  cancelled: { background: '#E6E7E8', text: '#666A70' },
};

export type RequestFilter = 'all' | 'new' | 'in_progress' | 'completed';

export const filters: readonly { key: RequestFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'new', label: 'Новые' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'completed', label: 'Завершены' },
];

/** Статусы, которые показывает фильтр; undefined — без отбора («Все»). */
export function filterStatuses(filter: RequestFilter): RequestStatus[] | undefined {
  switch (filter) {
    case 'new':
      return ['new'];
    case 'in_progress':
      return ['in_progress', 'waiting'];
    case 'completed':
      return ['completed', 'cancelled'];
    default:
      return undefined;
  }
}

/** Шаги шкалы статусов в карточке заявки. */
export const progressSteps: readonly { status: RequestStatus; label: string }[] = [
  { status: 'new', label: 'Новая' },
  { status: 'in_progress', label: 'В работе' },
  { status: 'waiting', label: 'Ожидание' },
  { status: 'completed', label: 'Завершена' },
];

/** Сколько сегментов шкалы закрашено; для «Отменена» — 0 (шкала серая). */
export function filledSteps(status: RequestStatus): number {
  if (status === 'cancelled') return 0;
  return progressSteps.findIndex((step) => step.status === status) + 1;
}
