import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ActionRow } from '../ActionRow';
import { AttachmentRow } from '../AttachmentRow';
import { BottomSheet } from '../BottomSheet';
import { Button } from '../Button';
import { Notice } from '../Notice';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const withProvider = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

describe('BottomSheet', () => {
  it('показывает заголовок и содержимое, пока открыт', async () => {
    await withProvider(
      <BottomSheet visible title="Категория" onClose={jest.fn()}>
        <ActionRow title="Отопление" onPress={jest.fn()} />
      </BottomSheet>,
    );
    expect(screen.getByText('Категория')).toBeOnTheScreen();
    expect(screen.getByText('Отопление')).toBeOnTheScreen();
  });

  it('ничего не рисует, пока закрыт', async () => {
    await withProvider(
      <BottomSheet visible={false} title="Категория" onClose={jest.fn()}>
        <ActionRow title="Отопление" onPress={jest.fn()} />
      </BottomSheet>,
    );
    expect(screen.queryByText('Категория')).not.toBeOnTheScreen();
  });

  it('закрывается нажатием на подложку', async () => {
    const onClose = jest.fn();
    await withProvider(
      <BottomSheet visible title="Адрес заявки" onClose={onClose} testID="sheet">
        <ActionRow title="Адрес" onPress={jest.fn()} />
      </BottomSheet>,
    );
    await fireEvent.press(screen.getByTestId('sheet-backdrop', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ActionRow', () => {
  it('выбранная строка помечена для читалки', async () => {
    await render(<ActionRow title="Отопление" selected onPress={jest.fn()} testID="row" />);
    expect(screen.getByTestId('row')).toBeSelected();
  });

  it('вызывает onPress', async () => {
    const onPress = jest.fn();
    await render(<ActionRow title="Лифт" onPress={onPress} testID="row" />);
    await fireEvent.press(screen.getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('AttachmentRow', () => {
  const handlers = { onRemove: jest.fn(), onCancel: jest.fn(), onRetry: jest.fn() };
  beforeEach(() => jest.clearAllMocks());

  it('загружено: размер и крестик удаления', async () => {
    await render(
      <AttachmentRow
        name="photo.jpg"
        kind="image"
        state={{ status: 'uploaded', sizeLabel: '1,2 МБ' }}
        testID="row"
        {...handlers}
      />,
    );
    expect(screen.getByText('1,2 МБ · загружено')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Удалить вложение' }));
    expect(handlers.onRemove).toHaveBeenCalledTimes(1);
  });

  it('идёт загрузка: процент и «Отменить загрузку» вместо удаления', async () => {
    await render(
      <AttachmentRow
        name="video.mp4"
        kind="video"
        state={{ status: 'uploading', progress: 0.35 }}
        testID="row"
        {...handlers}
      />,
    );
    expect(screen.getByTestId('row-percent')).toHaveTextContent('35%');
    expect(screen.queryByRole('button', { name: 'Удалить вложение' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Отменить загрузку' }));
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
  });

  it('не загрузилось: сообщение, «Повторить» на самой строке и удаление', async () => {
    await render(
      <AttachmentRow
        name="doc.pdf"
        kind="document"
        state={{ status: 'failed', message: 'Не загрузилось · нет связи' }}
        testID="row"
        {...handlers}
      />,
    );
    expect(screen.getByText('Не загрузилось · нет связи')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('row-retry'));
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Удалить вложение' }));
    expect(handlers.onRemove).toHaveBeenCalledTimes(1);
  });

  it('при блокировке кнопки строки не срабатывают', async () => {
    await render(
      <AttachmentRow
        name="photo.jpg"
        kind="image"
        state={{ status: 'uploaded', sizeLabel: '1 МБ' }}
        disabled
        testID="row"
        {...handlers}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Удалить вложение' }));
    expect(handlers.onRemove).not.toHaveBeenCalled();
  });
});

describe('Notice и Button', () => {
  it('плашка ошибки вызывает действие', async () => {
    const onAction = jest.fn();
    await render(
      <Notice
        message="Не загрузилось: 2 файла. Нет связи."
        actionLabel="Повторить все"
        onAction={onAction}
        testID="notice"
      />,
    );
    expect(screen.getByText('Не загрузилось: 2 файла. Нет связи.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('notice-action'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('кнопка во время загрузки показывает подпись «Отправляем…» и не нажимается', async () => {
    const onPress = jest.fn();
    await render(
      <Button title="Отправить заявку" loading loadingLabel="Отправляем…" onPress={onPress} />,
    );
    expect(screen.getByText('Отправляем…')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Отправляем…' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
