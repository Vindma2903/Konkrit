import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('вызывает onPress, когда активна', async () => {
    const onPress = jest.fn();
    await render(<Button title="Отправить заявку" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('не срабатывает, когда отключена', async () => {
    const onPress = jest.fn();
    await render(<Button title="Отправить заявку" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('не срабатывает во время загрузки', async () => {
    const onPress = jest.fn();
    await render(<Button title="Получить код" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button', { name: 'Получить код' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
