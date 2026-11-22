import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { Button, Icon, Screen, Text } from '@/ui';

/** Заглушка после отправки заявки: экраны S8–S11 — отдельное изменение. */
export function RequestSentScreen() {
  return (
    <Screen
      footer={
        <Button
          title="На главную"
          onPress={() => router.dismissTo('/home')}
          testID="request-sent-home"
        />
      }
    >
      <View style={styles.body}>
        <View style={styles.badge}>
          <Icon name="check" size={32} color={colors.onAccent} strokeWidth={2.4} />
        </View>
        <Text weight={800} size={24} lineHeight={30} accessibilityRole="header">
          Заявка отправлена
        </Text>
        <Text size={15} color={colors.textMuted} lineHeight={22}>
          Заявку получит диспетчер. Статус придёт в MAX и push.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingTop: 80, alignItems: 'flex-start' },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
