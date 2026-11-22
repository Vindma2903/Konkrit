import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

const buttons: { icon: IconName; label: string }[] = [
  { icon: 'photo', label: 'Фото' },
  { icon: 'video', label: 'Видео' },
  { icon: 'file', label: 'Файл' },
];

/**
 * Блок «Вложения»: три кнопки как в макете. Выбор и загрузка файлов — отдельное
 * изменение (S6, S7), поэтому нажатие пока ничего не открывает.
 */
export function AttachButtons() {
  return (
    <View style={styles.wrap}>
      <View style={styles.title}>
        <Text weight={700} size={13} color={colors.textMuted}>
          Вложения
        </Text>
        <Text weight={700} size={12} color={colors.textMuted}>
          До 10 файлов
        </Text>
      </View>
      <View style={styles.row}>
        {buttons.map((button) => (
          <Pressable
            key={button.label}
            accessibilityRole="button"
            accessibilityLabel={button.label}
            accessibilityState={{ disabled: true }}
            style={styles.tile}
            testID={`attach-${button.icon}`}
          >
            <Icon name={button.icon} color={colors.accentText} />
            <Text weight={700} size={12}>
              {button.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  title: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { flexDirection: 'row', gap: 10 },
  tile: {
    width: 96,
    height: 88,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
