import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useSessionStore } from '@/features/auth/sessionStore';
import { colors } from '@/theme';
import { Button, Screen, Text } from '@/ui';

/** Временная главная жителя: настоящая главная — отдельное изменение. */
export function HomeStubScreen() {
  return (
    <Screen
      footer={
        <>
          <Button
            title="Новая заявка"
            onPress={() => router.push('/requests/new')}
            testID="home-new-request"
          />
          <Button
            title="Выйти"
            onPress={() => void useSessionStore.getState().signOut()}
            variant="secondary"
            testID="home-sign-out"
          />
        </>
      }
    >
      <View style={styles.body}>
        <Text weight={800} size={24} lineHeight={30} accessibilityRole="header">
          Главная
        </Text>
        <Text size={15} color={colors.textMuted} lineHeight={22}>
          Главная жителя появится в следующих изменениях. Пока можно создать заявку.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingTop: 80 },
});
