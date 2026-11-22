import { render, screen } from '@testing-library/react-native';

import { TextField } from '../TextField';

describe('TextField', () => {
  it('показывает счётчик для многострочного поля', async () => {
    await render(
      <TextField label="Что случилось" value="Холодно" multiline showCounter maxLength={500} />,
    );
    expect(screen.getByText('7/500')).toBeOnTheScreen();
  });

  it('показывает ошибку вместо подсказки', async () => {
    await render(
      <TextField label="Номер телефона" hint="Код придёт в SMS." error="Неверный номер" />,
    );
    expect(screen.getByText('Неверный номер')).toBeOnTheScreen();
    expect(screen.queryByText('Код придёт в SMS.')).not.toBeOnTheScreen();
  });

  it('показывает подсказку без ошибки', async () => {
    await render(<TextField label="Номер телефона" hint="Код придёт в SMS." />);
    expect(screen.getByText('Код придёт в SMS.')).toBeOnTheScreen();
  });
});
