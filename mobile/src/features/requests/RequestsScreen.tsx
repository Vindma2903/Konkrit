import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApi, type RequestSummary } from '@/api';
import { colors, radius } from '@/theme';
import { Button, Chip, Icon, Text } from '@/ui';

import { DraftCard } from './DraftCard';
import { isDraftDirty, useRequestDraft } from './draftStore';
import { RequestListCard } from './RequestListCard';
import { filters, filterStatuses, type RequestFilter } from './status';

const FAB_HEIGHT = 56;
const FAB_GAP = 16;

/** Вкладка «Заявки»: фильтры, список с дозагрузкой и кнопка «Новая заявка» (макет «Мои заявки»). */
export function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<RequestFilter>('all');
  const [pulling, setPulling] = useState(false);

  const draft = useRequestDraft();
  const hasDraft = isDraftDirty(draft);

  const query = useInfiniteQuery({
    queryKey: ['requests', filter],
    queryFn: ({ pageParam }) =>
      getApi().listRequests({ statuses: filterStatuses(filter), cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  // При возврате на вкладку список обновляется (первый показ уже загружает запрос).
  const firstFocus = useRef(true);
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  async function pullToRefresh() {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }

  const draftCard = hasDraft ? (
    <DraftCard
      categoryName={draft.category?.name}
      description={draft.description}
      onPress={() => router.push('/requests/new')}
    />
  ) : null;

  let empty: React.ReactNode = null;
  if (query.isError && items.length === 0) {
    empty = (
      <View style={styles.state}>
        <Text weight={600} size={14} color={colors.error}>
          Не удалось загрузить заявки
        </Text>
        <Button title="Повторить" onPress={() => void refetch()} testID="requests-retry" />
      </View>
    );
  } else if (query.isPending) {
    empty = (
      <Text weight={600} size={14} color={colors.textMuted} testID="requests-loading">
        Загружаем заявки…
      </Text>
    );
  } else if (items.length === 0 && filter !== 'all') {
    empty = (
      <Text size={14} color={colors.textMuted} testID="requests-filter-empty">
        В этом разделе заявок нет
      </Text>
    );
  } else if (items.length === 0 && !hasDraft) {
    empty = (
      <View style={styles.state} testID="requests-empty">
        <Text weight={600} size={15}>
          Заявок пока нет
        </Text>
        <Button
          title="Создать заявку"
          onPress={() => router.push('/requests/new')}
          testID="requests-create"
        />
      </View>
    );
  }

  const footer = query.isFetchingNextPage ? (
    <ActivityIndicator color={colors.accent} style={styles.more} />
  ) : query.isError && items.length > 0 ? (
    <View style={styles.state}>
      <Text weight={600} size={13} color={colors.error}>
        Не удалось загрузить заявки
      </Text>
      <Button title="Повторить" onPress={() => void refetch()} testID="requests-retry" />
    </View>
  ) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text weight={800} size={20} accessibilityRole="header">
          Мои заявки
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filters}
        accessibilityRole="tablist"
      >
        {filters.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            tone="soft"
            selected={filter === item.key}
            onPress={() => setFilter(item.key)}
            testID={`filter-${item.key}`}
          />
        ))}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(item: RequestSummary) => item.id}
        renderItem={({ item }) => (
          <RequestListCard
            request={item}
            onPress={() => router.push({ pathname: '/requests/[id]', params: { id: item.id } })}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          draftCard || empty ? (
            <View style={styles.header}>
              {draftCard}
              {empty}
            </View>
          ) : undefined
        }
        ListFooterComponent={footer ?? undefined}
        contentContainerStyle={[styles.content, { paddingBottom: FAB_HEIGHT + FAB_GAP * 2 }]}
        style={styles.list}
        refreshing={pulling}
        onRefresh={() => void pullToRefresh()}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        testID="requests-list"
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Новая заявка"
        onPress={() => router.push('/requests/new')}
        style={styles.fab}
        testID="requests-new"
      >
        <Icon name="plus" color={colors.onAccent} />
        <Text weight={700} size={15} color={colors.onAccent}>
          Новая заявка
        </Text>
      </Pressable>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  titleRow: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  filtersScroll: { flexGrow: 0 },
  filters: { gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  list: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  header: { gap: 12, paddingBottom: 12 },
  separator: { height: 12 },
  state: { gap: 12 },
  more: { paddingVertical: 16 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: FAB_GAP,
    height: FAB_HEIGHT,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
