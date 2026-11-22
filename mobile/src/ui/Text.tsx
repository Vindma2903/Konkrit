import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, fontFamily, type FontWeight } from '@/theme';

export type TextProps = RNTextProps & {
  weight?: FontWeight;
  size?: number;
  color?: string;
  lineHeight?: number;
};

/** Текст с шрифтом Montserrat: вес задаётся числом, как в макете. */
export function Text({
  weight = 500,
  size = 15,
  color = colors.text,
  lineHeight,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={[{ fontFamily: fontFamily[weight], fontSize: size, color, lineHeight }, style]}
    />
  );
}
