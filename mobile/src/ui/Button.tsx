import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, sizes } from '@/theme';

import { Text } from './Text';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Подпись во время загрузки («Отправляем…»): рядом со спиннером; без неё виден только спиннер. */
  loadingLabel?: string;
  /** secondary — белая кнопка; danger — белая с красным текстом (удаление). */
  variant?: 'primary' | 'secondary' | 'danger';
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Основная кнопка: коралловая, серая при отключении, индикатор при загрузке. */
export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  loadingLabel,
  variant = 'primary',
  testID,
  style,
}: ButtonProps) {
  const inactive = disabled || loading;
  const light = variant !== 'primary';
  const textColor = disabled
    ? colors.disabledText
    : variant === 'danger'
      ? colors.error
      : variant === 'secondary'
        ? colors.text
        : colors.onAccent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel ? loadingLabel : title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        disabled ? styles.disabled : light ? styles.light : styles.active,
        loading && loadingLabel ? styles.loadingDim : null,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={light ? colors.accent : colors.onAccent} />
          {loadingLabel ? (
            <Text weight={700} size={16} color={light ? colors.text : colors.onAccent}>
              {loadingLabel}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text weight={700} size={16} color={textColor}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    height: sizes.button,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: colors.accent },
  light: { backgroundColor: colors.surface },
  disabled: { backgroundColor: colors.disabledBg },
  loadingDim: { opacity: 0.9 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.85 },
});
