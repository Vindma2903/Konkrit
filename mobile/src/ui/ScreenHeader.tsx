import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, sizes } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type ScreenHeaderProps = {
  title: string;
  /** По умолчанию — router.back(). */
  onBack?: () => void;
};

/** Шапка экрана: круглая кнопка «Назад» и заголовок 20/800. */
export function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Назад"
        onPress={onBack ?? (() => router.back())}
        testID="header-back"
        style={styles.back}
      >
        <Icon name="back" color={colors.text} />
      </Pressable>
      <Text weight={800} size={20} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: sizes.screenPadding,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: sizes.touch / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
