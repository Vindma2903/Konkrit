import { classifyCategory } from '../categories';

describe('classifyCategory', () => {
  it('подбирает «Отопление» по описанию из макета', () => {
    expect(classifyCategory('Нет отопления во всей квартире с утра')?.name).toBe('Отопление');
  });

  it('подбирает «Водоснабжение» по протечке', () => {
    expect(classifyCategory('Течёт кран на кухне, протечка')?.name).toBe('Водоснабжение');
  });

  it('подбирает «Лифт»', () => {
    expect(classifyCategory('Не работает лифт во втором подъезде')?.name).toBe('Лифт');
  });

  it('возвращает null, если подходящей категории нет', () => {
    expect(classifyCategory('Хочу узнать расписание')).toBeNull();
  });

  it('не зависит от регистра', () => {
    expect(classifyCategory('ЛИФТ СЛОМАЛСЯ')?.id).toBe('elevator');
  });
});
