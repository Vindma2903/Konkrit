import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';
import { Icon, Text } from '@/ui';

type SuggestionPlateProps = {
  categoryName: string;
  onChoose: () => void;
};

/** Плашка «Похоже на «Отопление»» с кнопкой «Выбрать» (S2). */
export function SuggestionPlate({ categoryName, onChoose }: SuggestionPlateProps) {
  return (
    <View style={styles.plate} testID="category-suggestion">
      <Icon name="suggest" size={18} color={colors.accentText} />
      <Text weight={700} size={13} color={colors.accentText} style={styles.text}>
        {`Похоже на «${categoryName}»`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Выбрать категорию «${categoryName}»`}
        onPress={onChoose}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={styles.button}
        testID="category-suggestion-choose"
      >
        <Text weight={700} size={13} color={colors.onAccent}>
          Выбрать
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.field,
    backgroundColor: colors.accentSoft,
  },
  text: { flex: 1 },
  button: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
