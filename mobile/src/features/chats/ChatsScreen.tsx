import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getApi, type Conversation } from '@/api';
import { colors, radius } from '@/theme';
import { Button, Icon, Text } from '@/ui';

import { ConversationCard } from './ConversationCard';
import { MANAGEMENT_CHAT_ID } from './conversationUi';

export const conversationsKey = ['conversations'];

/** Чаты дома от недавней активности к давней; чаты без сообщений в конце. */
function sortByActivity(items: Conversation[]): Conversation[] {
  return [...items].sort((a, b) => {
    // Чат без сообщений или с неверной датой — в конце; порядок остаётся последовательным
    const time = (item: Conversation) => {
      const value = item.last ? Date.parse(item.last.at) : Number.NaN;
      return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
    };
    const left = time(a);
    const right = time(b);
    return left === right ? 0 : right > left ? 1 : -1;
  });
}

const openChat = (id: string) => router.push({ pathname: '/chats/[id]', params: { id } });

/** Вкладка «Чат»: чаты дома и строка «Чат с УК» (макет «Житель: чаты дома»). */
export function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const [pulling, setPulling] = useState(false);
  const query = useQuery({ queryKey: conversationsKey, queryFn: () => getApi().listConversations() });
  const { refetch } = query;

  // При возврате на вкладку список обновляется: после чтения чата точка должна пропасть.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );

  const houseChats = useMemo(
    () => sortByActivity((query.data ?? []).filter((item) => item.kind !== 'management')),
    [query.data],
  );
  const management = query.data?.find((item) => item.kind === 'management');

  async function pullToRefresh() {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationCard conversation={item} onPress={() => openChat(item.id)} />
    ),
    [],
  );

  let state: React.ReactNode = null;
  if (query.isError && !query.data) {
    state = (
      <View style={styles.state}>
        <Text weight={600} size={14} color={colors.error}>
          Не удалось загрузить чаты
        </Text>
        <Button title="Повторить" onPress={() => void refetch()} testID="chats-retry" />
      </View>
    );
  } else if (query.isPending) {
    state = (
      <Text weight={600} size={14} color={colors.textMuted} testID="chats-loading">
        Загружаем чаты…
      </Text>
    );
  } else if (houseChats.length === 0) {
    state = (
      <Text size={14} color={colors.textMuted} testID="chats-empty">
        Чатов пока нет
      </Text>
    );
  }

  const footer = (
    <View style={styles.section}>
      <Text weight={700} size={13} color={colors.textMuted}>
        Управляющая компания
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={management?.unread ? 'Чат с УК. Есть непрочитанные' : 'Чат с УК'}
        onPress={() => openChat(management?.id ?? MANAGEMENT_CHAT_ID)}
        style={styles.management}
        testID="chat-management"
      >
        <Icon name="chat" color={colors.accentText} />
        <Text weight={700} size={15} color={colors.accentText} style={styles.managementTitle}>
          Чат с УК
        </Text>
        {management?.unread ? (
          <View style={styles.dot} testID="chat-management-unread" />
        ) : null}
        <Icon name="chevronRight" color={colors.accentText} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text weight={800} size={20} accessibilityRole="header">
          Чаты дома
        </Text>
      </View>
      <FlatList
        data={houseChats}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={state ? <View style={styles.header}>{state}</View> : undefined}
        ListFooterComponent={footer}
        contentContainerStyle={styles.content}
        style={styles.list}
        refreshing={pulling}
        onRefresh={() => void pullToRefresh()}
        testID="chats-list"
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
  list: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  header: { gap: 12, paddingBottom: 12 },
  separator: { height: 12 },
  state: { gap: 12 },
  section: { gap: 8, paddingTop: 24 },
  management: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  managementTitle: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
