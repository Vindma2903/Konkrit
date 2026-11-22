const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/** «22 ноября 2026»; для неверной даты — пустая строка. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** «1 заявка на доступ», «2 заявки на доступ», «5 заявок на доступ». */
export function pendingLabel(count: number): string {
  const last = count % 10;
  const tens = count % 100;
  const word =
    last === 1 && tens !== 11 ? 'заявка' : last >= 2 && last <= 4 && (tens < 12 || tens > 14) ? 'заявки' : 'заявок';
  return `${count} ${word} на доступ`;
}
