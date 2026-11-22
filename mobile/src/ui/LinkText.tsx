import { Linking } from 'react-native';

import { colors } from '@/theme';

import { Text, type TextProps } from './Text';

type LinkTextProps = Omit<TextProps, 'onPress'> & {
  /** Адрес документа; пока адреса нет — ссылка ничего не открывает. */
  href?: string;
  onPress?: () => void;
};

/** Ссылка по правилам заказчика: коралловый #A82E2E, жирная, подчёркнутая. */
export function LinkText({ href, onPress, style, size = 12, ...rest }: LinkTextProps) {
  return (
    <Text
      {...rest}
      weight={700}
      size={size}
      color={colors.accentText}
      accessibilityRole="link"
      onPress={() => {
        if (onPress) onPress();
        else if (href) void Linking.openURL(href);
      }}
      style={[{ textDecorationLine: 'underline' }, style]}
    />
  );
}
