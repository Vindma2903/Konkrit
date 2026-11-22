import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

type ProgressBarProps = {
  /** Доля от 0 до 1. */
  value: number;
  testID?: string;
};

/** Полоса прогресса загрузки: 4 px, акцент на сером. */
export function ProgressBar({ value, testID }: ProgressBarProps) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.track}
      testID={testID}
    >
      <View style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
});
