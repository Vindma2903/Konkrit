import { StyleSheet, View } from 'react-native';

import type { RequestStatus } from '@/api';
import { radius } from '@/theme';
import { Text } from '@/ui';

import { statusColors, statusLabels } from './status';

/** Плашка статуса заявки: один вид в списке, карточке и на экране «Заявка создана». */
export function StatusBadge({ status, testID }: { status: RequestStatus; testID?: string }) {
  const colors = statusColors[status];
  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]} testID={testID}>
      <Text weight={700} size={12} color={colors.text}>
        {statusLabels[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
