import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, sizes } from '@/theme';

import { Text } from './Text';

type ChipProps = {
  label: string;
  selected: boolean;
  /** solid — коралловая заливка (роль); soft — светло-коралловая (фильтры, по правилам заказчика про вкладки). */
  tone?: 'solid' | 'soft';
  onPress: () => void;
  testID?: string;
};

/** Чип выбора (роль: «Собственник» / «Жилец»). */
export function Chip({ label, selected, tone = 'solid', onPress, testID }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={[
        styles.base,
        selected ? (tone === 'soft' ? styles.selectedSoft : styles.selected) : styles.idle,
      ]}
    >
      <Text
        weight={700}
        size={14}
        color={selected ? (tone === 'soft' ? colors.accentText : colors.onAccent) : colors.text}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: sizes.touch,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.accent },
  selectedSoft: { backgroundColor: colors.accentSoft },
  idle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
