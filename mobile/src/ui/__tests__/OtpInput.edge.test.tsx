import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { OtpInput } from '../OtpInput';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <OtpInput value={value} onChange={setValue} accessibilityLabel="Код из SMS" />;
}

const cell = (index: number) => screen.getByTestId(`otp-cell-${index}`);
const code = () => Array.from({ length: 6 }, (_, index) => cell(index).props.value ?? '').join('');

describe('OtpInput: вставка и ввод не по порядку', () => {
  it('вставка 6 цифр при двух уже введённых заменяет код целиком', async () => {
    await render(<Harness initial="12" />);
    await fireEvent.changeText(cell(2), '345678');
    expect(code()).toBe('345678');
  });

  it('вставка короче кода дописывается после введённых', async () => {
    await render(<Harness initial="12" />);
    await fireEvent.changeText(cell(2), '3456');
    expect(code()).toBe('123456');
  });

  it('цифра в пустой ячейке дальше первой свободной ложится на первое свободное место', async () => {
    await render(<Harness initial="12" />);
    await fireEvent.changeText(cell(4), '9');
    expect(code()).toBe('129');
    expect(cell(4)).toHaveDisplayValue('');
  });

  it('цифра, дописанная в заполненную ячейку, заменяет её, а не две ячейки', async () => {
    await render(<Harness initial="12" />);
    // В ячейке «1» дописали «3»: поле отдало «13».
    await fireEvent.changeText(cell(0), '13');
    expect(code()).toBe('32');
  });

  it('стирание в пустой ячейке ничего не меняет', async () => {
    await render(<Harness initial="12" />);
    await fireEvent.changeText(cell(3), '');
    expect(code()).toBe('12');
  });
});
