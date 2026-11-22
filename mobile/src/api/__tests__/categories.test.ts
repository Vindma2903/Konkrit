import { classifyCategory } from '../categories';

describe('classifyCategory', () => {
  it('подбирает «Отопление» по описанию из макета', () => {
    expect(classifyCategory('Нет отопления во всей квартире с утра')?.name).toBe('Отопление');
  });

  it('подбирает «Протечку» по описанию', () => {
    expect(classifyCategory('Течёт кран на кухне, протечка')?.name).toBe('Протечка');
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

  it('домофон в подъезде — «Домофон», а не «Уборка»', () => {
    expect(classifyCategory('Не работает домофон в подъезде')?.id).toBe('intercom');
  });

  it('проводка не путается с водой: ищется начало слова', () => {
    expect(classifyCategory('Искрит проводка в коридоре')?.id).toBe('electrics');
    expect(classifyCategory('Нет воды в кране')?.id).toBe('plumbing');
  });
});
