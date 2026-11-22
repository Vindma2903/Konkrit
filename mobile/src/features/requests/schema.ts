import { z } from 'zod';

export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 500;

export const CATEGORY_ERROR = 'Выберите категорию';
export const DESCRIPTION_ERROR = `Опишите подробнее: минимум ${DESCRIPTION_MIN} символов`;

/** Правила формы новой заявки; пробелы по краям не считаются. */
export const requestSchema = z.object({
  categoryId: z.string({ error: CATEGORY_ERROR }).min(1, CATEGORY_ERROR),
  description: z
    .string()
    .trim()
    .min(DESCRIPTION_MIN, DESCRIPTION_ERROR)
    .max(DESCRIPTION_MAX, `Не больше ${DESCRIPTION_MAX} символов`),
});

export type RequestErrors = { category?: string; description?: string };

/** Ошибки по полям для текущих значений формы (пустой объект — форма верна). */
export function validateRequest(input: {
  categoryId: string | null;
  description: string;
}): RequestErrors {
  const result = requestSchema.safeParse({
    categoryId: input.categoryId ?? '',
    description: input.description,
  });
  if (result.success) return {};

  const errors: RequestErrors = {};
  for (const issue of result.error.issues) {
    if (issue.path[0] === 'categoryId') errors.category ??= issue.message;
    if (issue.path[0] === 'description') errors.description ??= issue.message;
  }
  return errors;
}

/** Форма пуста: не выбрана категория и нет текста — кнопка отправки неактивна (S1). */
export function isFormEmpty(input: { categoryId: string | null; description: string }): boolean {
  return !input.categoryId && input.description.trim().length === 0;
}
