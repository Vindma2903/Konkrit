import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/** Логотип «Конкрит»: коралловый квадрат со скруглением и контуром дома. */
export function Logo({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityRole="image" accessibilityLabel="Конкрит">
      <Rect width={36} height={36} rx={10} fill={colors.accent} />
      <Path
        d="M10 19 18 12l8 7v7H10Z"
        fill="none"
        stroke={colors.onAccent}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
