import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { Text } from './Text';

type RadioRowProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

/** Строка радио-выбора (способ подтверждения привязки). */
export function RadioRow({ label, selected, onPress, testID }: RadioRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      testID={testID}
      style={styles.row}
    >
      <View style={[styles.ring, { borderColor: selected ? colors.accent : colors.radioBorder }]}>
        {selected ? <View style={styles.dot} /> : null}
      </View>
      <Text weight={600} size={14}>
        {label}
      </Text>
      <View
        pointerEvents="none"
        style={[
          styles.frame,
          selected
            ? { borderWidth: 2, borderColor: colors.accent }
            : { borderWidth: 1, borderColor: colors.border },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radius.field,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  frame: { ...StyleSheet.absoluteFill, borderRadius: radius.field },
});
