import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Иконки макета: контурные, сетка 24×24, обводка 1.8. */
const glyphs = {
  back: <Path d="m15 6-6 6 6 6" />,
  check: <Path d="m5 12 5 5 9-10" />,
  checkBold: <Path d="m6 12.5 4 4 8-9" />,
  chevronDown: <Path d="m6 9 6 6 6-6" />,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  search: (
    <>
      <Circle cx={11} cy={11} r={7} />
      <Path d="m20 20-4-4" />
    </>
  ),
  home: (
    <>
      <Path d="m4 11 8-7 8 7v9H4Z" />
      <Path d="M10 20v-6h4v6" />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={13} r={8} />
      <Path d="M12 9v4l2.5 2M9 3h6" />
    </>
  ),
  warning: (
    <>
      <Path d="M12 4 3 20h18L12 4Z" />
      <Path d="M12 10v5M12 18h.01" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" />
      <Circle cx={12} cy={10} r={2.5} />
    </>
  ),
  photo: (
    <>
      <Rect x={3} y={5} width={18} height={14} rx={3} />
      <Circle cx={9} cy={10} r={1.6} />
      <Path d="m4 17 5-4 4 3 3-2 4 3" />
    </>
  ),
  video: (
    <>
      <Rect x={3} y={6} width={14} height={12} rx={3} />
      <Path d="m17 10 4-2v8l-4-2" />
    </>
  ),
  file: (
    <>
      <Path d="M7 3h7l5 5v13H7Z" />
      <Path d="M14 3v5h5" />
    </>
  ),
  camera: (
    <>
      <Path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
      <Circle cx={12} cy={13} r={3.5} />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  wifiOff: (
    <Path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" />
  ),
  news: (
    <>
      <Path d="M5 4h11a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2V4Z" />
      <Path d="M18 9h1a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2" />
      <Path d="M8 8h6M8 12h6M8 16h4" />
    </>
  ),
  requests: (
    <>
      <Rect x={5} y={4} width={14} height={17} rx={3} />
      <Path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  services: (
    <>
      <Rect x={4} y={4} width={7} height={7} rx={2} />
      <Rect x={13} y={4} width={7} height={7} rx={2} />
      <Rect x={4} y={13} width={7} height={7} rx={2} />
      <Rect x={13} y={13} width={7} height={7} rx={2} />
    </>
  ),
  chat: (
    <Path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
  ),
  profile: (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  attach: (
    <Path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7" />
  ),
  send: <Path d="M4 12 20 4l-4 16-4-6-8-2Z" />,
  suggest: (
    <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof glyphs;

type IconProps = {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {glyphs[name]}
    </Svg>
  );
}
