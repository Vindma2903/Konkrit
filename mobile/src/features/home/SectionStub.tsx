import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { Screen, Text } from '@/ui';

type SectionStubProps = {
  title: string;
  /** Кнопки и пояснения внизу экрана. */
  footer?: ReactNode;
};

/** Заглушка раздела, которого ещё нет: название и пояснение. Экран внутри вкладок. */
export function SectionStub({ title, footer }: SectionStubProps) {
  return (
    <Screen footer={footer} bottomInset={false}>
      <View style={styles.body}>
        <Text weight={800} size={24} lineHeight={30} accessibilityRole="header">
          {title}
        </Text>
        <Text size={15} color={colors.textMuted} lineHeight={22}>
          Раздел появится в следующих версиях
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingTop: 80 },
});
