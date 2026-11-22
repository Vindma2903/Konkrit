import { StyleSheet, View } from 'react-native';

import type { RequestStatus } from '@/api';
import { colors } from '@/theme';
import { Text } from '@/ui';

import { filledSteps, progressSteps } from '../status';

/** Шкала статусов заявки: четыре сегмента, закрашены до текущего включительно. */
export function ProgressScale({ status }: { status: RequestStatus }) {
  const filled = filledSteps(status);
  return (
    <View style={styles.row} testID="progress-scale">
      {progressSteps.map((step, index) => (
        <View key={step.status} style={styles.step}>
          <View
            style={[
              styles.bar,
              { backgroundColor: index < filled ? colors.accent : colors.border },
            ]}
            testID={`progress-step-${index}`}
          />
          <Text size={11} color={colors.textMuted}>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, gap: 6 },
  bar: { height: 6, borderRadius: 3 },
});
