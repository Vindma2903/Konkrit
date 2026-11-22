import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, sizes } from '@/theme';

import { FieldError } from './FieldError';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type SelectFieldProps = {
  label: string;
  /** Выбранное значение; если пусто — показывается placeholder. */
  value?: string;
  placeholder?: string;
  leftIcon?: IconName;
  error?: string;
  onPress?: () => void;
  testID?: string;
};

/** Выпадающее поле-кнопка (лист выбора открывается снаружи). */
export function SelectField({
  label,
  value,
  placeholder,
  leftIcon,
  error,
  onPress,
  testID,
}: SelectFieldProps) {
  const filled = Boolean(value);
  return (
    <View style={styles.wrap}>
      <Text weight={700} size={13} color={colors.textMuted}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value ?? placeholder }}
        onPress={onPress}
        testID={testID}
        style={[styles.box, error ? { borderWidth: 1.5, borderColor: colors.error } : null]}
      >
        <View style={styles.valueRow}>
          {leftIcon ? <Icon name={leftIcon} size={20} color={colors.accentText} /> : null}
          <Text
            weight={600}
            size={leftIcon ? 14 : 15}
            color={filled ? colors.text : colors.textMuted}
            numberOfLines={1}
            style={styles.value}
          >
            {value || placeholder}
          </Text>
        </View>
        <Icon name="chevronDown" size={20} color={colors.textMuted} />
      </Pressable>
      <FieldError message={error} testID={testID ? `${testID}-error` : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  box: {
    height: sizes.field,
    borderRadius: radius.field,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: { flexShrink: 1 },
});
