/** Токены темы «Коралл» (макеты P2-StyleA и экраны жителя). */

export const colors = {
  bg: '#F4F4F2',
  surface: '#FFFFFF',
  text: '#1D232B',
  textMuted: '#666A70',
  accent: '#CC3D3D',
  accentText: '#A82E2E',
  accentSoft: '#FDECEC',
  border: '#E6E7E8',
  disabledBg: '#E6E7E8',
  disabledText: '#6B7077',
  error: '#B3261E',
  success: '#1E6B3A',
  radioBorder: '#C4C7CB',
  onAccent: '#FFFFFF',
} as const;

export const radius = {
  card: 20,
  field: 14,
  pill: 999,
} as const;

export const sizes = {
  field: 52,
  button: 56,
  otpCellWidth: 48,
  otpCellHeight: 56,
  touch: 44,
  screenPadding: 20,
} as const;

export type FontWeight = 500 | 600 | 700 | 800;

/** Имена шрифтов, под которые регистрируются начертания Montserrat. */
export const fontFamily: Record<FontWeight, string> = {
  500: 'Montserrat_500Medium',
  600: 'Montserrat_600SemiBold',
  700: 'Montserrat_700Bold',
  800: 'Montserrat_800ExtraBold',
};
