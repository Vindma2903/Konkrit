import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Conversation } from '@/api';
import { formatListTime } from '@/lib/dateTime';
import { colors, radius } from '@/theme';
import { Icon, Text } from '@/ui';

import { conversationIcons } from './conversationUi';

type ConversationCardProps = {
  conversation: Conversation;
  onPress: () => void;
};

/** Карточка чата в списке: иконка, название, время, «Имя: сообщение» и точка непрочитанного. */
export const ConversationCard = memo(function ConversationCard({
  conversation,
  onPress,
}: ConversationCardProps) {
  const { id, kind, title, last, unread } = conversation;
  const preview = last ? `${last.authorName}: ${last.text}` : 'Сообщений пока нет';
  const time = last ? formatListTime(last.at) : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, unread ? 'Есть непрочитанные' : null, time || null, preview]
        .filter(Boolean)
        .join('. ')}
      onPress={onPress}
      style={styles.card}
      testID={`conversation-${id}`}
    >
      <View style={styles.icon}>
        <Icon name={conversationIcons[kind]} color={colors.accentText} />
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text weight={unread ? 800 : 700} size={16} numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {time ? (
            <Text weight={600} size={12} color={colors.textMuted}>
              {time}
            </Text>
          ) : null}
        </View>
        <View style={styles.bottom}>
          <Text
            weight={last && unread ? 600 : 500}
            size={13}
            color={last && unread ? colors.text : colors.textMuted}
            numberOfLines={1}
            style={styles.preview}
            testID={`conversation-${id}-preview`}
          >
            {preview}
          </Text>
          {unread ? <View style={styles.dot} testID={`conversation-${id}-unread`} /> : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
