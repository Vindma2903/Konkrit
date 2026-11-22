import { StyleSheet } from 'react-native';

import { colors } from '@/theme';
import { BottomSheet, Button, Text } from '@/ui';

type DiscardSheetProps = {
  visible: boolean;
  onSave: () => void;
  onDelete: () => void;
  onContinue: () => void;
};

/** Лист «Сохранить черновик?» (макет S11) при выходе с несохранёнными данными. */
export function DiscardSheet({ visible, onSave, onDelete, onContinue }: DiscardSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      title="Сохранить черновик?"
      onClose={onContinue}
      testID="discard-sheet"
    >
      <Text size={14} color={colors.textMuted} lineHeight={20}>
        Вы заполнили заявку, но не отправили её. Черновик сохранится в разделе «Заявки».
      </Text>
      <Button title="Сохранить черновик" onPress={onSave} testID="discard-save" />
      <Button
        title="Удалить"
        variant="danger"
        onPress={onDelete}
        style={styles.light}
        testID="discard-delete"
      />
      <Button
        title="Продолжить редактирование"
        variant="secondary"
        onPress={onContinue}
        style={styles.light}
        testID="discard-continue"
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  light: { backgroundColor: colors.bg },
});
