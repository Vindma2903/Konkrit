import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RequestSummary } from '@/api';
import { colors, radius } from '@/theme';
import { Text } from '@/ui';

import { StatusBadge } from './StatusBadge';

type RequestListCardProps = {
  request: RequestSummary;
  onPress: () => void;
};

/** Карточка заявки в списке: категория, статус, заголовок, исполнитель. */
export const RequestListCard = memo(function RequestListCard({
  request,
  onPress,
}: RequestListCardProps) {
  const executor = request.executor
    ? `${request.executor.name}, ${request.executor.position}`
    : 'Не назначен';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Заявка ${request.number}: ${request.title}`}
      onPress={onPress}
      style={styles.card}
      testID={`request-card-${request.id}`}
    >
      <View style={styles.top}>
        <Text weight={700} size={13} color={colors.accentText} style={styles.category}>
          {request.categoryName}
        </Text>
        <StatusBadge status={request.status} />
      </View>
      <Text weight={600} size={15} lineHeight={20}>
        {request.title}
      </Text>
      <Text weight={500} size={12} color={colors.textMuted}>
        {`Исполнитель: ${executor}`}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 8,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  category: { flexShrink: 1 },
});
