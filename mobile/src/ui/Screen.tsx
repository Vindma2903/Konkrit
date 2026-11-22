import { useState, type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, sizes } from '@/theme';

type ScreenProps = {
  /** Шапка (ScreenHeader) или любой верхний блок. */
  header?: ReactNode;
  /** Закреплённый низ: кнопка и пояснение. */
  footer?: ReactNode;
  children: ReactNode;
  contentGap?: number;
  scrollRef?: Ref<ScrollViewInstance>;
};

/**
 * Каркас экрана: шапка, вертикальный скролл всего экрана, закреплённый низ.
 * Если содержимое не помещается, над низом рисуется тень.
 */
export function Screen({ header, footer, children, contentGap = 20, scrollRef }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const overflows = contentHeight > viewportHeight + 1;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {header}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { gap: contentGap }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={overflows}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        onContentSizeChange={(_, height) => setContentHeight(height)}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12) + 12 },
            overflows ? styles.footerShadow : null,
          ]}
          testID="screen-footer"
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: sizes.screenPadding, paddingTop: 8, paddingBottom: 12 },
  footer: {
    paddingHorizontal: sizes.screenPadding,
    paddingTop: 12,
    gap: 10,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  footerShadow: {
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -10 },
    elevation: 8,
  },
});
