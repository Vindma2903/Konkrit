import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type SelectableCardProps = {
  title: string;
  subtitle: string;
  caption: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

/** Карточка дома: одиночный выбор, выбранная — коралловая рамка и галочка. */
export function SelectableCard({
  title,
  subtitle,
  caption,
  selected,
  onPress,
  testID,
}: SelectableCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      testID={testID}
      style={styles.card}
    >
      <View style={styles.iconBox}>
        <Icon name="home" color={colors.accentText} />
      </View>
      <View style={styles.texts}>
        <Text weight={700} size={15}>
          {title}
        </Text>
        <Text weight={500} size={13} color={colors.textMuted}>
          {subtitle}
        </Text>
        <Text weight={600} size={12} color={colors.textMuted}>
          {caption}
        </Text>
      </View>
      {selected ? (
        <View style={styles.checked}>
          <Icon name="checkBold" size={18} color={colors.onAccent} />
        </View>
      ) : (
        <View style={styles.unchecked} />
      )}
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
  card: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.field,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  checked: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unchecked: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.radioBorder,
  },
  frame: { ...StyleSheet.absoluteFill, borderRadius: radius.card },
});
