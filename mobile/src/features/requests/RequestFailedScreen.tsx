import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { Button, Icon, Screen, Text } from '@/ui';

const texts = {
  network: 'Нет связи с интернетом. Черновик сохранён. Повторите, когда появится сеть.',
  rejected: 'Сервер не принял заявку. Проверьте данные и попробуйте снова.',
} as const;

/** Экран «Не удалось отправить» (макет S10). Параметр маршрута: reason = network | rejected. */
export function RequestFailedScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const rejected = reason === 'rejected';

  return (
    <Screen
      footer={
        <>
          <Button
            title="Повторить"
            onPress={() =>
              router.replace({
                pathname: '/requests/new',
                // При отказе сервера сразу не отправляем: сначала нужно поправить данные.
                params: rejected ? {} : { retry: '1' },
              })
            }
            testID="request-failed-retry"
          />
          <Button
            title="Закрыть, оставить в черновиках"
            variant="secondary"
            onPress={() => router.dismissTo('/home')}
            testID="request-failed-close"
          />
        </>
      }
    >
      <View style={styles.body}>
        <View style={styles.badge}>
          <Icon name="wifiOff" size={44} color={colors.error} />
        </View>
        <View style={styles.texts}>
          <Text
            weight={800}
            size={24}
            lineHeight={29}
            accessibilityRole="header"
            style={styles.center}
          >
            Не удалось отправить
          </Text>
          <Text
            size={14}
            color={colors.textMuted}
            lineHeight={21}
            style={styles.center}
            testID="request-failed-text"
          >
            {rejected ? texts.rejected : texts.network}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: 20, paddingTop: 120 },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { gap: 8, alignItems: 'center' },
  center: { textAlign: 'center' },
});
