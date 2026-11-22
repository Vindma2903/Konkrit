import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApi, type NewsItem, type NewsKind, type NewsPage } from '@/api';
import { colors } from '@/theme';
import { Button, Chip, Text } from '@/ui';

import { NewsCard } from './NewsCard';

const kinds: { key: NewsKind; label: string; empty: string }[] = [
  { key: 'news', label: 'Новости', empty: 'Пока нет новостей' },
  { key: 'announcement', label: 'Объявления', empty: 'Пока нет объявлений' },
];

const openNews = (id: string) => router.push({ pathname: '/news/[id]', params: { id } });

/** Вкладка «Новости»: переключатель «Новости / Объявления» и карточки (макет «Житель: новости»). */
export function NewsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<NewsKind>('news');
  const [pulling, setPulling] = useState(false);

  // Для каждого раздела свой запрос: при возврате на «Новости» загруженные карточки не теряются.
  const query = useInfiniteQuery({
    queryKey: ['news', kind],
    queryFn: ({ pageParam }) => getApi().listNews({ kind, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  // Колбэк обновления не должен меняться при смене раздела: useFocusEffect вызвал бы его заново.
  const latest = useRef({ kind, refetch: query.refetch });
  useEffect(() => {
    latest.current = { kind, refetch: query.refetch };
  });

  /**
   * Обновление с первой страницы. Свежая первая страница подменяет весь список только после
   * успешного ответа: при сбое загруженные карточки остаются.
   */
  const refreshFirstPage = useCallback(async () => {
    const { kind: current, refetch } = latest.current;
    const key = ['news', current];
    if (!queryClient.getQueryData(key)) {
      await refetch();
      return;
    }
    try {
      const first = await getApi().listNews({ kind: current, cursor: null });
      queryClient.setQueryData<InfiniteData<NewsPage, string | null>>(key, {
        pages: [first],
        pageParams: [null],
      });
    } catch {
      // сбой обновления: прежний список остаётся на экране
    }
  }, [queryClient]);

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

  const renderItem = useCallback(
    ({ item }: { item: NewsItem }) => <NewsCard item={item} onPress={() => openNews(item.id)} />,
    [],
  );

  let state: React.ReactNode = null;
  if (query.isError && items.length === 0) {
    state = (
      <View style={styles.state}>
        <Text weight={600} size={14} color={colors.error}>
          Не удалось загрузить новости
        </Text>
        <Button title="Повторить" onPress={() => void refreshFirstPage()} testID="news-retry" />
      </View>
    );
  } else if (query.isPending) {
    state = (
      <Text weight={600} size={14} color={colors.textMuted} testID="news-loading">
        Загружаем новости…
      </Text>
    );
  } else if (items.length === 0) {
    state = (
      <Text size={14} color={colors.textMuted} testID="news-empty">
        {kinds.find((item) => item.key === kind)?.empty}
      </Text>
    );
  }

  const footer = query.isFetchingNextPage ? (
    <ActivityIndicator color={colors.accent} style={styles.more} />
  ) : query.isError && items.length > 0 ? (
    <View style={styles.state}>
      <Text weight={600} size={13} color={colors.error}>
        Не удалось загрузить новости
      </Text>
      <Button title="Повторить" onPress={() => void query.fetchNextPage()} testID="news-retry" />
    </View>
  ) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text weight={800} size={20} accessibilityRole="header">
          Новости
        </Text>
      </View>
      <View style={styles.switcher}>
        {kinds.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            tone="soft"
            selected={kind === item.key}
            onPress={() => setKind(item.key)}
            testID={`news-kind-${item.key}`}
          />
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={state ? <View style={styles.header}>{state}</View> : undefined}
        ListFooterComponent={footer ?? undefined}
        contentContainerStyle={styles.content}
        style={styles.list}
        refreshing={pulling}
        onRefresh={() => void pullToRefresh()}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage && !query.isError) {
            void query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        testID="news-list"
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  titleRow: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  switcher: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  list: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  header: { gap: 12, paddingBottom: 12 },
  separator: { height: 12 },
  state: { gap: 12 },
  more: { paddingVertical: 16 },
});
