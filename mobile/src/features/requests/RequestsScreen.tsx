import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApi, type RequestsPage, type RequestSummary } from '@/api';
import { colors, radius } from '@/theme';
import { Button, Chip, Icon, Text } from '@/ui';

import { DraftCard } from './DraftCard';
import { useRequestDraft } from './draftStore';
import { RequestListCard } from './RequestListCard';
import { filters, filterStatuses, type RequestFilter } from './status';

const FAB_HEIGHT = 56;
const FAB_GAP = 16;

/** Вкладка «Заявки»: фильтры, список с дозагрузкой и кнопка «Новая заявка» (макет «Мои заявки»). */
export function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<RequestFilter>('all');
  const [pulling, setPulling] = useState(false);

  // Селекторы по отдельности: набор текста в форме не должен перерисовывать список целиком.
  const draftCategory = useRequestDraft((state) => state.category);
  const draftDescription = useRequestDraft((state) => state.description);
  const draftFiles = useRequestDraft((state) => state.attachments.length);
  const hasDraft = draftCategory !== null || draftDescription.trim().length > 0 || draftFiles > 0;
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['requests', filter],
    queryFn: ({ pageParam }) =>
      getApi().listRequests({ statuses: filterStatuses(filter), cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const { refetch } = query;

  /** Обновление списка заново с первой страницы: загруженные дальше страницы отбрасываем. */
  const refreshFirstPage = useCallback(async () => {
    queryClient.setQueryData<InfiniteData<RequestsPage, string | null>>(
      ['requests', filter],
      (data) =>
        data ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
    );
    await refetch();
  }, [filter, queryClient, refetch]);

  // При возврате на вкладку список обновляется (первый показ уже загружает запрос).
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refreshFirstPage();
    }, [refreshFirstPage]),
  );

  // Страницы склеиваются без повторов: сервер мог сдвинуть записи между запросами.
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (query.data?.pages ?? [])
      .flatMap((page) => page.items)
      .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
  }, [query.data]);

  async function pullToRefresh() {
    setPulling(true);
    try {
      await refreshFirstPage();
    } finally {
      setPulling(false);
    }
  }

  const openRequest = useCallback(
    (id: string) => router.push({ pathname: '/requests/[id]', params: { id } }),
    [],
  );
  const renderItem = useCallback(
    ({ item }: { item: RequestSummary }) => (
      <RequestListCard request={item} onPress={() => openRequest(item.id)} />
    ),
    [openRequest],
  );

  const draftCard = hasDraft ? (
    <DraftCard
      categoryName={draftCategory?.name}
      description={draftDescription}
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
        <Button title="Повторить" onPress={() => void refreshFirstPage()} testID="requests-retry" />
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
      <Button title="Повторить" onPress={() => void refreshFirstPage()} testID="requests-retry" />
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
        renderItem={renderItem}
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
