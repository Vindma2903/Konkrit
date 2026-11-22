import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
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
  /** secondary — белая кнопка для второстепенных действий. */
  variant?: 'primary' | 'secondary';
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/** Основная кнопка: коралловая, серая при отключении, индикатор при загрузке. */
export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  testID,
  style,
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        disabled ? styles.disabled : variant === 'secondary' ? styles.secondary : styles.active,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.accent : colors.onAccent} />
      ) : (
        <Text
          weight={700}
          size={16}
          color={
            disabled ? colors.disabledText : variant === 'secondary' ? colors.text : colors.onAccent
          }
        >
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
  secondary: { backgroundColor: colors.surface },
  disabled: { backgroundColor: colors.disabledBg },
  pressed: { opacity: 0.85 },
});
