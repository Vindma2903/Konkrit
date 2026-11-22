import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { Screen, ScreenHeader, Text } from '@/ui';

import { sectionTitle } from './sections';

/** Раздел профиля, которого ещё нет: название и пояснение, «Назад» возвращает в профиль. */
export function SectionScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  return (
    <Screen header={<ScreenHeader title={sectionTitle(section)} />}>
      <View style={styles.body}>
        <Text size={15} color={colors.textMuted} lineHeight={22} testID="section-stub">
          Раздел появится в следующих версиях
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 40 },
});
