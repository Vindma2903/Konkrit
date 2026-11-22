import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { OtpInput } from '../OtpInput';

function Harness({ onComplete }: { onComplete?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <OtpInput
      value={value}
      onChange={setValue}
      onComplete={onComplete}
      accessibilityLabel="Код из SMS"
    />
  );
}

const cell = (index: number) => screen.getByTestId(`otp-cell-${index}`);

describe('OtpInput', () => {
  it('записывает цифры по ячейкам', async () => {
    await render(<Harness />);
    await fireEvent.changeText(cell(0), '1');
    await fireEvent.changeText(cell(1), '2');
    expect(cell(0)).toHaveDisplayValue('1');
    expect(cell(1)).toHaveDisplayValue('2');
    expect(cell(2)).toHaveDisplayValue('');
  });

  it('игнорирует не цифры', async () => {
    await render(<Harness />);
    await fireEvent.changeText(cell(0), 'a');
    expect(cell(0)).toHaveDisplayValue('');
  });

  it('заполняет все ячейки при вставке и вызывает onComplete один раз', async () => {
    const onComplete = jest.fn();
    await render(<Harness onComplete={onComplete} />);
    await fireEvent.changeText(cell(0), '123456');
    for (let index = 0; index < 6; index += 1) {
      expect(cell(index)).toHaveDisplayValue(String(index + 1));
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('обрезает вставку длиннее кода', async () => {
    await render(<Harness />);
    await fireEvent.changeText(cell(0), '12345678');
    expect(cell(5)).toHaveDisplayValue('6');
  });

  it('стирает цифру и позволяет ввести заново', async () => {
    const onComplete = jest.fn();
    await render(<Harness onComplete={onComplete} />);
    await fireEvent.changeText(cell(0), '123456');
    await fireEvent.changeText(cell(5), '');
    expect(cell(5)).toHaveDisplayValue('');
    await fireEvent.changeText(cell(5), '9');
    expect(onComplete).toHaveBeenLastCalledWith('123459');
  });
});
