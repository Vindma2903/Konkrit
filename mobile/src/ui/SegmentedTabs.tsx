import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, sizes } from '@/theme';

import { Text } from './Text';

type Option<T extends string> = { key: T; label: string };

type SegmentedTabsProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (key: T) => void;
  accessibilityLabel: string;
};

/** Переключатель способа: серая подложка, активный — белая плашка (как в макете входа). */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedTabsProps<T>) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.track}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.key)}
            testID={`tab-${option.key}`}
            style={[styles.tab, selected ? styles.tabActive : null]}
          >
            <Text weight={700} size={14} color={selected ? colors.text : colors.textMuted}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 4,
  },
  tab: {
    flex: 1,
    height: sizes.touch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#141E28',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
