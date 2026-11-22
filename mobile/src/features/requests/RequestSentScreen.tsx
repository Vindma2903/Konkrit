import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { formatDateTime } from '@/lib/dateTime';
import { colors, radius } from '@/theme';
import { Button, Icon, Screen, Text } from '@/ui';

import { useCreatedRequest } from './createdRequestStore';
import { StatusBadge } from './StatusBadge';

/** Экран «Заявка создана» (макет S9). Данные берёт из итога последней отправки. */
export function RequestSentScreen() {
  const summary = useCreatedRequest((state) => state.summary);

  // Заявка уже создана: «Назад» ведёт на главную, а не в пустую форму.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.dismissTo('/home');
      return true;
    });
    return () => subscription.remove();
  }, []);

  if (!summary) return <Redirect href="/home" />;

  return (
    <Screen
      footer={
        <>
          <Button
            title="Открыть заявку"
            onPress={() => {
              // Сначала «Мои заявки», затем карточка: «Назад» из карточки ведёт в список, а не в форму.
              router.dismissTo('/requests');
              router.push({ pathname: '/requests/[id]', params: { id: summary.id } });
            }}
            testID="request-sent-open"
          />
          <Button
            title="На главную"
            variant="secondary"
            onPress={() => router.dismissTo('/home')}
            testID="request-sent-home"
          />
        </>
      }
    >
      <View style={styles.body}>
        <View style={styles.badge}>
          <Icon name="check" size={44} color={colors.success} />
        </View>
        <View style={styles.texts}>
          <Text
            weight={800}
            size={24}
            lineHeight={29}
            accessibilityRole="header"
            style={styles.center}
          >
            {`Заявка № ${summary.number} создана`}
          </Text>
          <Text size={14} color={colors.textMuted} lineHeight={21} style={styles.center}>
            Мы уведомим вас в MAX и push, когда статус изменится.
          </Text>
        </View>

        <View style={styles.card} testID="request-sent-card">
          <View style={styles.cardTop}>
            <Text weight={600} size={12} color={colors.textMuted}>
              {formatDateTime(summary.createdAt)}
            </Text>
            <StatusBadge status="new" />
          </View>
          <Text weight={700} size={16}>
            {summary.categoryName}
          </Text>
          <Text size={13} color={colors.textMuted}>
            {summary.address}
          </Text>
          <Text weight={600} size={13} color={colors.accentText}>
            {`Диспетчер ответит в течение ${summary.answerWithinMin} мин`}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: 20, paddingTop: 48 },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DDF3E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { gap: 8, alignItems: 'center' },
  center: { textAlign: 'center' },
  card: {
    alignSelf: 'stretch',
    padding: 16,
    gap: 10,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
