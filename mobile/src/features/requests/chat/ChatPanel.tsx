import { useCallback, useMemo, useState } from 'react';
import { FlatList, Linking, StyleSheet, View } from 'react-native';

import { attachmentLimits } from '@/config';
import { colors } from '@/theme';
import { Button, FieldError, LinkText, Text } from '@/ui';

import { AttachSheet } from '../AttachSheet';
import { getPickers, type PickResult } from '../pickers';
import type { ChatMessage } from '@/api';
import { formatClock } from '@/lib/dateTime';

import { bubbleFromMessage, ChatBubble } from './ChatBubble';
import { ChatInputBar } from './ChatInputBar';
import { runPick } from './pickFlow';
import type { ChannelId } from './outbox';
import { useChannelChat, type ChatItem } from './useChannelChat';

type ChatPanelProps = {
  channel: ChannelId;
  /** Переписка открыта и виден экран: только тогда идёт опрос. */
  active: boolean;
  /** Текст пустой переписки. */
  emptyText: string;
  /**
   * Подпись над сообщением сервера: строка, null — без подписи; без функции — по роли автора
   * (как в чате заявки). Если задана функция, под сообщением показывается и время.
   */
  labelFor?: (message: ChatMessage) => string | null;
};

/** Переписка с вводом: сообщения, строка со скрепкой, отправка. Общая для чата заявки и чатов дома. */
export function ChatPanel({ channel, active, emptyText, labelFor }: ChatPanelProps) {
  const { items, isPending, isError, refetch, sendText, sendFile, retry } = useChannelChat(
    channel,
    active,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [denied, setDenied] = useState<'camera' | 'library' | null>(null);

  async function pick(run: () => Promise<PickResult>) {
    setSheetOpen(false);
    setMessages([]);
    setDenied(null);
    const outcome = await runPick(run);
    setMessages(outcome.messages);
    setDenied(outcome.denied);
    for (const file of outcome.accepted) sendFile(file);
  }

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const pickers = getPickers();

  // Новейшие сообщения внизу: список перевёрнут, поэтому данные идут от новых к старым.
  const data = useMemo(() => [...items].reverse(), [items]);
  const renderItem = useCallback(
    ({ item }: { item: ChatItem }) =>
      item.kind === 'server' ? (
        <ChatBubble
          {...bubbleFromMessage(item.message)}
          {...(labelFor
            ? { label: labelFor(item.message), time: formatClock(item.message.createdAt) }
            : {})}
          delivery="sent"
          testID={`message-${item.key}`}
        />
      ) : (
        <ChatBubble
          mine
          role="resident"
          {...(labelFor ? { label: null } : {})}
          text={item.pending.text}
          attachment={
            item.pending.file
              ? {
                  kind: item.pending.file.kind,
                  name: item.pending.file.name,
                  url: item.pending.file.uri,
                }
              : undefined
          }
          delivery={item.pending.status}
          onRetry={() => retry(item.pending.clientMessageId)}
          testID={`message-${item.key}`}
        />
      ),
    [retry, labelFor],
  );

  return (
    <View style={styles.root}>
      <View style={styles.area}>
        {isError && items.length === 0 ? (
          <View style={styles.state}>
            <Text weight={600} size={14} color={colors.error}>
              Не удалось загрузить переписку
            </Text>
            <Button title="Повторить" onPress={() => void refetch()} testID="chat-retry" />
          </View>
        ) : isPending ? (
          <Text weight={600} size={14} color={colors.textMuted}>
            Загружаем переписку…
          </Text>
        ) : items.length === 0 ? (
          <Text size={14} color={colors.textMuted} testID="chat-empty">
            {emptyText}
          </Text>
        ) : (
          <FlatList
            inverted
            data={data}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            ItemSeparatorComponent={Separator}
            contentContainerStyle={styles.messages}
            testID="chat-list"
          />
        )}
      </View>

      {messages.map((message, index) => (
        <FieldError key={`${index}-${message}`} message={message} testID="chat-message-error" />
      ))}
      {denied ? (
        <View style={styles.denied} testID="chat-permission">
          <FieldError
            message={
              denied === 'camera'
                ? 'Нет доступа к камере. Разрешите его в настройках телефона'
                : 'Нет доступа к фото. Разрешите его в настройках телефона'
            }
          />
          <LinkText size={13} onPress={() => void Linking.openSettings()}>
            Открыть настройки
          </LinkText>
        </View>
      ) : null}

      <ChatInputBar onSend={sendText} onAttach={openSheet} />

      <AttachSheet
        visible={sheetOpen}
        onCamera={() => void pick(() => pickers.takeMedia('any'))}
        onGallery={() =>
          void pick(() =>
            pickers.pickFromGallery({ limit: attachmentLimits.maxFiles, mode: 'any' }),
          )
        }
        onDocument={() => void pick(() => pickers.pickDocument())}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 8 },
  area: { flex: 1 },
  state: { gap: 12 },
  messages: { paddingBottom: 8 },
  separator: { height: 12 },
  denied: { gap: 4 },
});
