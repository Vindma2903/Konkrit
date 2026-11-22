import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { NewsItem } from '@/api';
import { formatNewsDate } from '@/lib/dateTime';
import { colors, radius } from '@/theme';
import { Text } from '@/ui';

import { NewsImage } from './NewsImage';

type NewsCardProps = {
  item: NewsItem;
  onPress: () => void;
};

/** Карточка новости в списке: картинка 120, дата, заголовок, превью в две строки. */
export const NewsCard = memo(function NewsCard({ item, onPress }: NewsCardProps) {
  const date = formatNewsDate(item.date);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[date, item.title].filter(Boolean).join('. ')}
      onPress={onPress}
      style={styles.card}
      testID={`news-card-${item.id}`}
    >
      <NewsImage uri={item.imageUrl} height={120} radius={radius.card - 6} testID={`news-card-${item.id}-media`} />
      <View style={styles.text}>
        {date ? (
          <Text weight={600} size={12} color={colors.textMuted}>
            {date}
          </Text>
        ) : null}
        <Text weight={700} size={16} lineHeight={21}>
          {item.title}
        </Text>
        <Text weight={500} size={13} lineHeight={18} color={colors.textMuted} numberOfLines={2}>
          {item.preview}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { padding: 12, gap: 12, borderRadius: radius.card, backgroundColor: colors.surface },
  text: { gap: 4, paddingHorizontal: 4, paddingBottom: 4 },
});
