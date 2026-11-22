import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { Button, Icon, Screen, Text } from '@/ui';

import { useOnboardingStore } from './onboardingStore';

/** Заглушка после отправки привязки: макета этого состояния пока нет. */
export function ResidencySentScreen() {
  return (
    <Screen
      footer={
        <Button
          title="На главную"
          onPress={() => {
            useOnboardingStore.getState().reset();
            // Стек онбординга убираем, чтобы «Назад» с главной не вёл на «Ваш дом».
            if (router.canDismiss()) router.dismissAll();
            router.replace('/home');
          }}
          testID="residency-sent-home"
        />
      }
    >
      <View style={styles.body}>
        <View style={styles.badge}>
          <Icon name="check" size={32} color={colors.onAccent} strokeWidth={2.4} />
        </View>
        <Text weight={800} size={24} lineHeight={30} accessibilityRole="header">
          Заявка на привязку отправлена
        </Text>
        <Text size={15} color={colors.textMuted} lineHeight={22}>
          УК проверит данные и подтвердит привязку квартиры. Статус придёт в MAX и push.
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
