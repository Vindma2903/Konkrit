const pad = (value: number) => String(value).padStart(2, '0');

/** «22.11.2026, 14:05» в часовом поясе устройства; для неверной даты — пустая строка. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
