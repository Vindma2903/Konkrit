import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import type { ChatMessage, MessageAttachment, MessageAuthorRole } from '@/api';
import { colors } from '@/theme';
import { Icon, Text, type IconName } from '@/ui';

const authorLabels: Record<MessageAuthorRole, string> = {
  resident: 'Вы',
  executor: 'Исполнитель',
  curator: 'Куратор',
  dispatcher: 'Диспетчер',
};

const kindIcons: Record<MessageAttachment['kind'], IconName> = {
  image: 'photo',
  video: 'video',
  document: 'file',
};

export type BubbleDelivery = 'sent' | 'sending' | 'failed';

type ChatBubbleProps = {
  mine: boolean;
  role: MessageAuthorRole;
  text?: string;
  attachment?: Pick<MessageAttachment, 'kind' | 'name' | 'url'>;
  delivery: BubbleDelivery;
  onRetry?: () => void;
  testID: string;
};

/** Сообщение переписки: чужие слева на белом, свои справа на коралловом; фото — картинка 160×96. */
export const ChatBubble = memo(function ChatBubble({
  mine,
  role,
  text,
  attachment,
  delivery,
  onRetry,
  testID,
}: ChatBubbleProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const label = mine ? authorLabels.resident : authorLabels[role];
  const photo = attachment?.kind === 'image';

  return (
    <View style={[styles.column, mine ? styles.mine : styles.theirs]} testID={testID}>
      <Text weight={600} size={11} color={colors.textMuted}>
        {label}
      </Text>

      {attachment && photo ? (
        <View style={styles.photo} testID={`${testID}-photo`}>
          {!imageFailed ? (
            <Image
              source={{ uri: attachment.url }}
              style={styles.photoImage}
              onError={() => setImageFailed(true)}
              accessibilityLabel={attachment.name}
            />
          ) : (
            <Text weight={600} size={12} color={colors.textMuted}>
              Фото
            </Text>
          )}
        </View>
      ) : attachment ? (
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, styles.file]}>
          <Icon
            name={kindIcons[attachment.kind]}
            size={20}
            color={mine ? colors.onAccent : colors.textMuted}
          />
          <Text
            weight={500}
            size={14}
            color={mine ? colors.onAccent : colors.text}
            numberOfLines={1}
            style={styles.fileName}
          >
            {attachment.name}
          </Text>
        </View>
      ) : null}

      {text ? (
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text weight={500} size={14} lineHeight={20} color={mine ? colors.onAccent : colors.text}>
            {text}
          </Text>
        </View>
      ) : null}

      {delivery === 'sending' ? (
        <Text weight={500} size={11} color={colors.textMuted} testID={`${testID}-state`}>
          Отправляется…
        </Text>
      ) : null}
      {delivery === 'failed' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Повторить отправку"
          onPress={onRetry}
          hitSlop={{ left: 8, right: 8 }}
          style={styles.retry}
          testID={`${testID}-retry`}
        >
          <Text weight={700} size={11} color={colors.error}>
            Не отправлено · Повторить
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

/** Подпись автора и признак «своё» берутся из сообщения сервера. */
export function bubbleFromMessage(message: ChatMessage) {
  return {
    mine: message.mine,
    role: message.author.role,
    text: message.text,
    attachment: message.attachment,
  };
}

const styles = StyleSheet.create({
  column: { gap: 4, maxWidth: '100%' },
  retry: { minHeight: 44, justifyContent: 'center' },
  mine: { alignItems: 'flex-end' },
  theirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: 260, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMine: { backgroundColor: colors.accent },
  bubbleTheirs: { backgroundColor: colors.surface },
  file: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileName: { flexShrink: 1 },
  photo: {
    width: 160,
    height: 96,
    borderRadius: 18,
    backgroundColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: { ...StyleSheet.absoluteFill },
});
