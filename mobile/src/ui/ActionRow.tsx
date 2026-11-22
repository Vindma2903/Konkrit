import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ActionRowProps = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Выбранная строка: фон #FDECEC, жирный текст, галочка справа. */
  selected?: boolean;
  onPress: () => void;
  testID?: string;
};

/** Строка листа: действие или вариант выбора (макеты S5, S6, S12). */
export function ActionRow({ title, subtitle, icon, selected, onPress, testID }: ActionRowProps) {
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { selected, checked: selected }}
      onPress={onPress}
      testID={testID}
      style={[styles.row, selected ? styles.rowSelected : null]}
    >
      {icon ? <Icon name={icon} size={22} color={colors.accentText} /> : null}
      <View style={styles.texts}>
        <Text weight={selected ? 700 : icon ? 700 : 600} size={15}>
          {title}
        </Text>
        {subtitle ? (
          <Text weight={500} size={12} color={colors.textMuted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {selected ? <Icon name="check" size={20} color={colors.accentText} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: 14,
    borderRadius: radius.field,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowSelected: { backgroundColor: colors.accentSoft },
  texts: { flex: 1, gap: 2 },
});
