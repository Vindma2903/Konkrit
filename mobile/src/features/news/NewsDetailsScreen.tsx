import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, getApi, type NewsDetails } from '@/api';
import { formatNewsDate } from '@/lib/dateTime';
import { colors, radius, sizes } from '@/theme';
import { Button, ScreenHeader, Text } from '@/ui';

import { NewsImage } from './NewsImage';

/** Текст для системного окна «Поделиться»: заголовок и первый абзац. */
export function shareMessage(news: Pick<NewsDetails, 'title' | 'body'>): string {
  return [news.title, news.body[0]].filter(Boolean).join('\n\n');
}

/** Экран новости: картинка, дата, заголовок, абзацы и закреплённая «Поделиться» (макет «Житель: новость»). */
export function NewsDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const newsId = id ?? '';
  const insets = useSafeAreaInsets();
  const news = useQuery({
    queryKey: ['news-item', newsId],
    queryFn: () => getApi().getNews(newsId),
    enabled: newsId.length > 0,
  });

  const notFound =
    !newsId || (!news.data && news.error instanceof ApiError && news.error.code === 'not_found');

  async function share(item: NewsDetails) {
    try {
      await Share.share({ message: shareMessage(item) });
    } catch {
      // окно не открылось — делиться нечем, но и показывать нечего: новость остаётся на экране
    }
  }

  let content: React.ReactNode;
  if (notFound) {
    content = (
      <View style={styles.state}>
        <Text weight={600} size={15}>
          Новость не найдена
        </Text>
        <Button title="К новостям" onPress={() => router.replace('/home')} testID="news-to-list" />
      </View>
    );
  } else if (news.isError && !news.data) {
    content = (
      <View style={styles.state}>
        <Text weight={600} size={14} color={colors.error}>
          Не удалось загрузить новость
        </Text>
        <Button title="Повторить" onPress={() => void news.refetch()} testID="news-details-retry" />
      </View>
    );
  } else if (!news.data) {
    content = (
      <Text weight={600} size={14} color={colors.textMuted} testID="news-details-loading">
        Загружаем новость…
      </Text>
    );
  } else {
    const item = news.data;
    content = (
      <>
        <NewsImage uri={item.imageUrl} height={200} radius={radius.card} testID="news-details-media" />
        <Text weight={600} size={12} color={colors.textMuted}>
          {formatNewsDate(item.date)}
        </Text>
        <Text weight={800} size={22} lineHeight={27} accessibilityRole="header">
          {item.title}
        </Text>
        {item.body.map((paragraph, index) => (
          <Text key={index} weight={500} size={15} lineHeight={23} testID={`news-paragraph-${index}`}>
            {paragraph}
          </Text>
        ))}
      </>
    );
  }

  const shareable = news.data && !notFound ? news.data : null;
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Новость" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {content}
      </ScrollView>
      {shareable ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <Button
            title="Поделиться"
            icon="share"
            onPress={() => void share(shareable)}
            testID="news-share"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: sizes.screenPadding, paddingTop: 8, paddingBottom: 16, gap: 12 },
  state: { gap: 12 },
  footer: { paddingHorizontal: sizes.screenPadding, paddingTop: 12, backgroundColor: colors.bg },
});
