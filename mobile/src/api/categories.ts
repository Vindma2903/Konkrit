import type { Category } from './types';

export const categories: readonly Category[] = [
  { id: 'heating', name: 'Отопление' },
  { id: 'water', name: 'Водоснабжение' },
  { id: 'electricity', name: 'Электричество' },
  { id: 'elevator', name: 'Лифт' },
  { id: 'cleaning', name: 'Уборка' },
  { id: 'doors', name: 'Двери и домофон' },
  { id: 'other', name: 'Другое' },
];

/** Основы слов, по которым подбирается категория (нижний регистр). */
const keywords: Record<string, readonly string[]> = {
  heating: ['отоплен', 'батаре', 'радиатор', 'холодн', 'тепл'],
  water: ['протеч', 'течёт', 'течет', 'кран', 'труб', 'вод', 'канализ', 'засор'],
  electricity: ['свет', 'электр', 'розетк', 'проводк', 'лампочк', 'щиток'],
  elevator: ['лифт'],
  cleaning: ['уборк', 'мусор', 'грязн', 'подъезд'],
  doors: ['домофон', 'дверь', 'двери', 'замок', 'ключ'],
};

/** Локальный подбор категории по тексту; null, если подходящей нет. */
export function classifyCategory(text: string): Category | null {
  const normalized = text.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const [id, stems] of Object.entries(keywords)) {
    const score = stems.filter((stem) => normalized.includes(stem)).length;
    if (score > 0 && (!best || score > best.score)) best = { id, score };
  }
  return best ? (categories.find((category) => category.id === best.id) ?? null) : null;
}
