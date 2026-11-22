import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { Button, Screen, Text } from '@/ui';

/** Заглушка карточки заявки: настоящая карточка — отдельное изменение. */
export function RequestDetailsStub() {
  const { number } = useLocalSearchParams<{ number?: string }>();
  return (
    <Screen
      footer={
        <Button
          title="На главную"
          onPress={() => router.dismissTo('/home')}
          testID="details-home"
        />
      }
    >
      <View style={styles.body}>
        <Text weight={800} size={24} lineHeight={30} accessibilityRole="header">
          {number ? `Заявка № ${number}` : 'Заявка'}
        </Text>
        <Text size={15} color={colors.textMuted} lineHeight={22}>
          Карточка заявки появится в следующих изменениях.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingTop: 80 },
});
