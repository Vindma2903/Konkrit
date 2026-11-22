import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';
import { Text } from '@/ui';

type DraftCardProps = {
  categoryName?: string;
  description: string;
  onPress: () => void;
};

/** Карточка «Черновик заявки» над списком: открывает форму с сохранёнными данными. */
export function DraftCard({ categoryName, description, onPress }: DraftCardProps) {
  const text = description.trim();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Черновик заявки"
      onPress={onPress}
      style={styles.card}
      testID="draft-card"
    >
      <View style={styles.top}>
        <Text weight={700} size={13} color={colors.accentText} style={styles.category}>
          {categoryName ?? 'Черновик заявки'}
        </Text>
        <View style={styles.badge}>
          <Text weight={700} size={12} color={colors.textMuted}>
            Черновик
          </Text>
        </View>
      </View>
      <Text weight={600} size={15} lineHeight={20} numberOfLines={2}>
        {text || 'Без описания'}
      </Text>
      <Text weight={500} size={12} color={colors.textMuted}>
        Нажмите, чтобы продолжить
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 8,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  category: { flexShrink: 1 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
});
