import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type NoticeProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

/** Красная плашка над списком файлов: «Не загрузилось: 2 файла. Нет связи.» и «Повторить все». */
export function Notice({ message, actionLabel, onAction, testID }: NoticeProps) {
  return (
    <View accessibilityRole="alert" style={styles.plate} testID={testID}>
      <Icon name="wifiOff" size={18} color={colors.error} />
      <Text weight={700} size={12} color={colors.error} lineHeight={16} style={styles.message}>
        {message}
      </Text>
      {actionLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={{ top: 5, bottom: 5 }}
          style={styles.action}
          testID={testID ? `${testID}-action` : undefined}
        >
          <Text weight={800} size={12} color={colors.onAccent}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.field,
    backgroundColor: colors.accentSoft,
  },
  message: { flex: 1 },
  action: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
