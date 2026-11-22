import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type FieldErrorProps = {
  message?: string;
  testID?: string;
};

/** Ошибка под полем: иконка-треугольник и красный текст 12/600. */
export function FieldError({ message, testID }: FieldErrorProps) {
  if (!message) return null;
  return (
    <View style={styles.row} accessibilityRole="alert" testID={testID}>
      <Icon name="warning" size={14} color={colors.error} />
      <Text weight={600} size={12} color={colors.error} style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { flexShrink: 1 },
});
