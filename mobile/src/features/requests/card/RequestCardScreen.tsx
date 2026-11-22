import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, getApi } from '@/api';
import { formatDateTime } from '@/lib/dateTime';
import { colors, radius } from '@/theme';
import { Button, ScreenHeader, SegmentedTabs, Text } from '@/ui';

import { StatusBadge } from '../StatusBadge';
import { ChatTab } from '../chat/ChatTab';
import { FilesTab } from './FilesTab';
import { HistoryTab } from './HistoryTab';
import { PeopleBlock } from './PeopleBlock';
import { ProgressScale } from './ProgressScale';

type CardTab = 'chat' | 'history' | 'files';

const tabs = [
  { key: 'chat', label: 'Чат' },
  { key: 'history', label: 'История' },
  { key: 'files', label: 'Файлы' },
] as const;

/** Карточка заявки жителя: сводка, шкала, люди и вкладки «Чат / История / Файлы» (макет). */
export function RequestCardScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const requestId = id ?? '';
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<CardTab>('chat');
  const [focused, setFocused] = useState(true);

  // Чат опрашивается, только пока экран на виду.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const request = useQuery({
    queryKey: ['request', requestId],
    queryFn: () => getApi().getRequest(requestId),
    enabled: requestId.length > 0,
  });

  const notFound =
    (request.error instanceof ApiError && request.error.code === 'not_found') || !requestId;

  const title = request.data ? `Заявка № ${request.data.number}` : 'Заявка';

  let body: React.ReactNode;
  if (notFound) {
    body = (
      <View style={styles.state}>
        <Text weight={600} size={15}>
          Заявка не найдена
        </Text>
        <Button
          title="К списку заявок"
          onPress={() => router.replace('/requests')}
          testID="card-to-list"
        />
      </View>
    );
  } else if (request.isError) {
    body = (
      <View style={styles.state}>
        <Text weight={600} size={14} color={colors.error}>
          Не удалось загрузить заявку
        </Text>
        <Button title="Повторить" onPress={() => void request.refetch()} testID="card-retry" />
      </View>
    );
  } else if (!request.data) {
    body = (
      <Text weight={600} size={14} color={colors.textMuted} testID="card-loading">
        Загружаем заявку…
      </Text>
    );
  } else {
    const data = request.data;
    body = (
      <>
        <View style={styles.summary} testID="card-summary">
          <View style={styles.summaryTop}>
            <Text weight={600} size={12} color={colors.textMuted}>
              {`Создана ${formatDateTime(data.createdAt)}`}
            </Text>
            <StatusBadge status={data.status} testID="card-status" />
          </View>
          <Text weight={800} size={22} lineHeight={27}>
            {data.title}
          </Text>
          <ProgressScale status={data.status} />
        </View>
        <PeopleBlock curator={data.curator} executor={data.executor} />
        <SegmentedTabs
          options={tabs}
          value={tab}
          onChange={setTab}
          accessibilityLabel="Разделы заявки"
          testIDPrefix="card-tab"
        />
        {/* Чат не закрываем при смене вкладки: введённый текст и неотправленные сообщения остаются. */}
        <View style={tab === 'chat' ? styles.content : styles.hidden}>
          <ChatTab requestId={data.id} active={focused && tab === 'chat'} />
        </View>
        {tab === 'history' ? (
          <View style={styles.content}>
            <HistoryTab requestId={data.id} />
          </View>
        ) : null}
        {tab === 'files' ? (
          <View style={styles.content}>
            <FilesTab requestId={data.id} />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title={title} />
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
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  state: { gap: 12 },
  summary: { padding: 16, gap: 12, borderRadius: radius.card, backgroundColor: colors.surface },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  content: { flex: 1 },
  hidden: { display: 'none' },
});
