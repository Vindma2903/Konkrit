import { useCallback, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { attachmentLimits } from '@/config';
import { colors, fontFamily, sizes } from '@/theme';
import { Button, FieldError, Icon, LinkText, Text } from '@/ui';

import { AttachSheet } from '../AttachSheet';
import { getPickers, type PickResult } from '../pickers';
import { bubbleFromMessage, ChatBubble } from './ChatBubble';
import { runPick } from './pickFlow';
import { useRequestChat, type ChatItem } from './useRequestChat';

const MESSAGE_MAX = 1000;

type ChatTabProps = {
  requestId: string;
  /** Вкладка «Чат» открыта и виден экран: только тогда идёт опрос. */
  active: boolean;
};

/** Вкладка «Чат»: переписка, строка ввода со скрепкой и отправка (макет «Карточка заявки»). */
export function ChatTab({ requestId, active }: ChatTabProps) {
  const chat = useRequestChat(requestId, active);
  const [text, setText] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [denied, setDenied] = useState<'camera' | 'library' | null>(null);

  const canSend = text.trim().length > 0;

  function send() {
    if (!canSend) return;
    chat.sendText(text);
    setText('');
  }

  async function pick(run: () => Promise<PickResult>) {
    setSheetOpen(false);
    setMessages([]);
    setDenied(null);
    const outcome = await runPick(run);
    setMessages(outcome.messages);
    setDenied(outcome.denied);
    for (const file of outcome.accepted) chat.sendFile(file);
  }

  const pickers = getPickers();

  // Новейшие сообщения внизу: список перевёрнут, поэтому данные идут от новых к старым.
  const data = [...chat.items].reverse();
  const renderItem = useCallback(
    ({ item }: { item: ChatItem }) =>
      item.kind === 'server' ? (
        <ChatBubble
          {...bubbleFromMessage(item.message)}
          delivery="sent"
          testID={`message-${item.key}`}
        />
      ) : (
        <ChatBubble
          mine
          role="resident"
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
          onRetry={() => chat.retry(item.pending.clientMessageId)}
          testID={`message-${item.key}`}
        />
      ),
    [chat],
  );

  return (
    <View style={styles.root}>
      <View style={styles.area}>
        {chat.isError && chat.items.length === 0 ? (
          <View style={styles.state}>
            <Text weight={600} size={14} color={colors.error}>
              Не удалось загрузить переписку
            </Text>
            <Button title="Повторить" onPress={() => void chat.refetch()} testID="chat-retry" />
          </View>
        ) : chat.isPending ? (
          <Text weight={600} size={14} color={colors.textMuted}>
            Загружаем переписку…
          </Text>
        ) : chat.items.length === 0 ? (
          <Text size={14} color={colors.textMuted} testID="chat-empty">
            Сообщений пока нет. Напишите исполнителю или куратору
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

      <View style={styles.inputRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Прикрепить файл"
          onPress={() => setSheetOpen(true)}
          style={[styles.round, styles.attach]}
          testID="chat-attach"
        >
          <Icon name="attach" size={24} color={colors.text} />
        </Pressable>
        <TextInput
          accessibilityLabel="Сообщение"
          placeholder="Сообщение"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={(value) => setText(value.slice(0, MESSAGE_MAX))}
          maxLength={MESSAGE_MAX}
          maxFontSizeMultiplier={1.3}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={send}
          style={styles.input}
          testID="chat-input"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Отправить"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={send}
          style={[styles.round, canSend ? styles.send : styles.sendOff]}
          testID="chat-send"
        >
          <Icon name="send" size={24} color={canSend ? colors.onAccent : colors.disabledText} />
        </Pressable>
      </View>

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
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  round: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: sizes.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attach: { backgroundColor: colors.surface },
  send: { backgroundColor: colors.accent },
  sendOff: { backgroundColor: colors.disabledBg },
  input: {
    flex: 1,
    height: sizes.touch,
    paddingHorizontal: 16,
    borderRadius: sizes.touch / 2,
    backgroundColor: colors.surface,
    fontFamily: fontFamily[500],
    fontSize: 14,
    color: colors.text,
  },
});
