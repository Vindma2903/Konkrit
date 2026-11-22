import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getApi } from '@/api';
import { formatDateTime } from '@/lib/dateTime';
import { colors, radius } from '@/theme';
import { Button, Text } from '@/ui';

/** Вкладка «История»: события заявки, новые сверху. */
export function HistoryTab({ requestId }: { requestId: string }) {
  const history = useQuery({
    queryKey: ['request', requestId, 'history'],
    queryFn: () => getApi().listHistory(requestId),
  });

  if (history.isError) {
    return (
      <View style={styles.state}>
        <Text weight={600} size={14} color={colors.error}>
          Не удалось загрузить историю
        </Text>
        <Button title="Повторить" onPress={() => void history.refetch()} testID="history-retry" />
      </View>
    );
  }
  if (history.isPending) {
    return (
      <Text weight={600} size={14} color={colors.textMuted}>
        Загружаем историю…
      </Text>
    );
  }
  if (history.data.length === 0) {
    return (
      <Text size={14} color={colors.textMuted}>
        История пока пуста
      </Text>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.list} testID="history-list">
      {history.data.map((item) => (
        <View key={item.id} style={styles.row} testID={`history-${item.id}`}>
          <Text weight={600} size={14}>
            {item.text}
          </Text>
          <Text weight={500} size={12} color={colors.textMuted}>
            {formatDateTime(item.at)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  state: { gap: 12 },
  list: { gap: 8, paddingBottom: 16 },
  row: { padding: 12, gap: 4, borderRadius: radius.field, backgroundColor: colors.surface },
});
