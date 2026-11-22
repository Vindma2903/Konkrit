import { isFormEmpty, validateRequest } from '../schema';

describe('validateRequest', () => {
  const ok = { categoryId: 'heating', description: 'Нет отопления во всей квартире' };

  it('верная форма — ошибок нет', () => {
    expect(validateRequest(ok)).toEqual({});
  });

  it('категория обязательна', () => {
    expect(validateRequest({ ...ok, categoryId: null }).category).toBe('Выберите категорию');
  });

  it('описание: границы 9, 10, 500 и 501 символ', () => {
    const message = 'Опишите подробнее: минимум 10 символов';
    expect(validateRequest({ ...ok, description: 'а'.repeat(9) }).description).toBe(message);
    expect(validateRequest({ ...ok, description: 'а'.repeat(10) }).description).toBeUndefined();
    expect(validateRequest({ ...ok, description: 'а'.repeat(500) }).description).toBeUndefined();
    expect(validateRequest({ ...ok, description: 'а'.repeat(501) }).description).toBe(
      'Не больше 500 символов',
    );
  });

  it('пробелы по краям не считаются символами', () => {
    expect(validateRequest({ ...ok, description: '   Холодно   ' }).description).toBeDefined();
    expect(validateRequest({ ...ok, description: ' '.repeat(20) }).description).toBeDefined();
  });

  it('собирает обе ошибки сразу', () => {
    const errors = validateRequest({ categoryId: null, description: 'Холодно' });
    expect(errors.category).toBeDefined();
    expect(errors.description).toBeDefined();
  });
});

describe('isFormEmpty', () => {
  it('пуста, когда нет категории и текста', () => {
    expect(isFormEmpty({ categoryId: null, description: '' })).toBe(true);
    expect(isFormEmpty({ categoryId: null, description: '   ' })).toBe(true);
  });

  it('не пуста, как только появился ввод или категория', () => {
    expect(isFormEmpty({ categoryId: null, description: 'а' })).toBe(false);
    expect(isFormEmpty({ categoryId: 'heating', description: '' })).toBe(false);
  });
});
