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
  chevronRight: <Path d="m9 6 6 6-6 6" />,
  building: (
    <>
      <Path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
      <Path d="M15 10h3a1 1 0 0 1 1 1v10" />
      <Path d="M3 21h18M9 8h2M9 12h2M9 16h2" />
    </>
  ),
  door: (
    <>
      <Path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" />
      <Path d="M4 21h16" />
      <Circle cx={14.5} cy={12.5} r={0.8} />
    </>
  ),
  people: (
    <>
      <Circle cx={9} cy={8} r={3.5} />
      <Path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <Circle cx={17} cy={9} r={2.5} />
      <Path d="M17 14a5 5 0 0 1 4.5 6" />
    </>
  ),
  logout: (
    <>
      <Path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <Path d="m16 8 4 4-4 4M20 12H9" />
    </>
  ),
  bell: (
    <>
      <Path d="M6 17v-6a6 6 0 0 1 12 0v6l1.5 2h-15Z" />
      <Path d="M10 21h4" />
    </>
  ),
  wallet: (
    <>
      <Rect x={3} y={6} width={18} height={14} rx={3} />
      <Path d="M3 10h18M16 15h2" />
    </>
  ),
  help: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" />
    </>
  ),
  share: (
    <>
      <Circle cx={6} cy={12} r={2.5} />
      <Circle cx={18} cy={6} r={2.5} />
      <Circle cx={18} cy={18} r={2.5} />
      <Path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </>
  ),
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
