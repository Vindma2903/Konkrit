import type { Category } from './types';

/** Категории из макета S12. Список в приложении приходит из API; здесь — данные мока. */
export const categories: readonly Category[] = [
  { id: 'leak', name: 'Протечка' },
  { id: 'heating', name: 'Отопление' },
  { id: 'elevator', name: 'Лифт' },
  { id: 'electrics', name: 'Электрика' },
  { id: 'plumbing', name: 'Сантехника' },
  { id: 'intercom', name: 'Домофон' },
  { id: 'other', name: 'Другое' },
];

/** Основы слов, по которым подбирается категория (нижний регистр). */
const keywords: Record<string, readonly string[]> = {
  leak: ['протеч', 'течёт', 'течет', 'затоп', 'капает', 'подтоп'],
  heating: ['отоплен', 'батаре', 'радиатор', 'холодн', 'тепл'],
  elevator: ['лифт'],
  electrics: ['свет', 'электр', 'розетк', 'проводк', 'лампочк', 'щиток'],
  plumbing: ['кран', 'труб', 'вод', 'канализ', 'засор', 'унитаз', 'смесител'],
  intercom: ['домофон', 'дверь', 'двери', 'замок', 'ключ'],
};

/** Основа слова должна стоять в начале слова: «вод» находит «вода», но не «проводка». */
const startsWord = (text: string, stem: string) => new RegExp(`(?:^|[^а-яё])${stem}`).test(text);

/** Локальный подбор категории по тексту; null, если подходящей нет. */
export function classifyCategory(text: string): Category | null {
  const normalized = text.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const [id, stems] of Object.entries(keywords)) {
    const score = stems.filter((stem) => startsWord(normalized, stem)).length;
    if (score > 0 && (!best || score > best.score)) best = { id, score };
  }
  return best ? (categories.find((category) => category.id === best.id) ?? null) : null;
}
