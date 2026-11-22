import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, getApi, type ChatMessage, type Conversation } from '@/api';
import { colors, sizes } from '@/theme';
import { Button, Icon, Text } from '@/ui';

import { ChatPanel } from '../requests/chat/ChatPanel';
import {
  channelMessagesKey,
  chatChannel,
  listChannelMessages,
} from '../requests/chat/outbox';
import { conversationsKey } from './ChatsScreen';
import { conversationIcons, isGroupChat } from './conversationUi';

/** Переписка в чате дома или с УК (макет «Житель: чат с УК»; групповые чаты — тот же экран). */
export function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const chatId = id ?? '';
  const channel = chatChannel(chatId);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [focused, setFocused] = useState(true);

  // Опрос идёт, только пока экран на виду.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const conversation = useQuery({
    queryKey: ['conversation', chatId],
    queryFn: () => getApi().getConversation(chatId),
    enabled: chatId.length > 0,
  });
  // Тот же ключ, что у переписки внутри панели: запрос общий, здесь только следим за новыми сообщениями.
  const messages = useQuery({
    queryKey: channelMessagesKey(channel),
    queryFn: () => listChannelMessages(channel),
    enabled: chatId.length > 0 && conversation.isSuccess,
  });

  // Открыли чат или пришло новое сообщение на открытом экране — чат прочитан.
  const lastId = messages.data?.at(-1)?.id ?? '';
  const markedFor = useRef<string | null>(null);
  // Отмечаем, когда переписка показана: ушедший без загрузки сообщений ничего не прочитал.
  const ready = conversation.isSuccess && messages.isSuccess;
  useEffect(() => {
    if (!ready || !focused) return;
    const key = `${chatId}:${lastId}`;
    if (markedFor.current === key) return;
    markedFor.current = key;
    getApi()
      .markChatRead(chatId)
      .then(() => {
        queryClient.setQueryData<Conversation[]>(conversationsKey, (list) =>
          list?.map((item) => (item.id === chatId ? { ...item, unread: false } : item)),
        );
      })
      .catch(() => {
        // не отметилось — попробуем при следующем сообщении или открытии
        if (markedFor.current === key) markedFor.current = null;
      });
  }, [ready, focused, chatId, lastId, queryClient]);

  const group = conversation.data ? isGroupChat(conversation.data.kind) : false;
  const labelFor = useCallback(
    (message: ChatMessage) => (!message.mine && group ? (message.author.name ?? null) : null),
    [group],
  );

  const notFound =
    !chatId ||
    (!conversation.data &&
      conversation.error instanceof ApiError &&
      conversation.error.code === 'not_found');

  let body: React.ReactNode;
  if (notFound) {
    body = (
      <View style={styles.state}>
        <Text weight={600} size={15}>
          Чат не найден
        </Text>
        <Button title="К чатам" onPress={() => router.replace('/chat')} testID="conversation-to-list" />
      </View>
    );
  } else if (conversation.isError && !conversation.data) {
    body = (
      <View style={styles.state}>
        <Text weight={600} size={14} color={colors.error}>
          Не удалось загрузить переписку
        </Text>
        <Button
          title="Повторить"
          onPress={() => void conversation.refetch()}
          testID="conversation-retry"
        />
      </View>
    );
  } else if (!conversation.data) {
    body = (
      <Text weight={600} size={14} color={colors.textMuted} testID="conversation-loading">
        Загружаем переписку…
      </Text>
    );
  } else {
    body = (
      <ChatPanel
        channel={channel}
        active={focused}
        emptyText="Сообщений пока нет. Напишите первым"
        labelFor={labelFor}
      />
    );
  }

  const data = conversation.data;
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          onPress={() => router.back()}
          style={styles.back}
          testID="header-back"
        >
          <Icon name="back" color={colors.text} />
        </Pressable>
        {data ? (
          <View style={styles.avatar}>
            <Icon name={conversationIcons[data.kind]} size={22} color={colors.accentText} />
          </View>
        ) : null}
        <View style={styles.titles}>
          <Text weight={800} size={16} numberOfLines={1} accessibilityRole="header">
            {data?.title ?? 'Чат'}
          </Text>
          {data?.subtitle ? (
            <Text weight={500} size={12} color={colors.textMuted} numberOfLines={1} testID="conversation-subtitle">
              {data.subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: sizes.screenPadding,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    width: sizes.touch,
    height: sizes.touch,
    borderRadius: sizes.touch / 2,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, gap: 2 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  state: { gap: 12 },
});
