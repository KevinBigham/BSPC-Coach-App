// BSPC Coach App — "Arcade Prime Time" Theme
// Dark broadcast-studio aesthetic with retro pixel accents

export const colors = {
  // Dark Backgrounds
  bgDeep: '#08080f',
  bgBase: '#0a0a12',
  bgElevated: '#131320',
  bgSurface: '#161628',

  // BSPC Identity
  purple: '#4A0E78',
  purpleDark: '#350A58',
  purpleLight: '#7B3FA0',
  purpleGlow: '#6B2FA0',

  // Arcade Accents
  gold: '#FFD700',
  goldDark: '#CCB000',
  accent: '#B388FF', // light purple — active states, links, tab highlights
  success: '#CCB000', // dark gold — success, streaks, attendance confirmed

  // Semantic
  background: '#0a0a12',
  surface: '#131320',
  surfaceElevated: '#161628',
  text: '#f0f0f8',
  textSecondary: '#a0a0b8',
  textInverse: '#0a0a12',
  border: '#2a2a40',
  borderLight: '#1e1e32',
  borderAccent: '#3a3a55',

  // Status
  successLight: 'rgba(204, 176, 0, 0.12)',
  error: '#f43f5e',
  errorLight: 'rgba(244, 63, 94, 0.12)',
  warning: '#fbbf24',
  warningLight: 'rgba(251, 191, 36, 0.12)',
  info: '#B388FF',
  infoLight: 'rgba(179, 136, 255, 0.10)',

  // Group badges
  groupBronze: '#CD7F32',
  groupSilver: '#C0C0C0',
  groupGold: '#FFD700',
  groupAdvanced: '#3B82F6',
  groupPlatinum: '#A0AEC0',
  groupDiamond: '#8B5CF6',
} as const;

export const fontFamily = {
  heading: 'Teko_700Bold',
  headingMd: 'Teko_500Medium',
  stat: 'JetBrainsMono_700Bold',
  statMono: 'JetBrainsMono_400Regular',
  pixel: 'PressStart2P_400Regular',
  body: 'Inter_400Regular',
  bodyMed: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const fontSize = {
  xs: 10,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  pixel: 8,
  pixelLg: 10,
} as const;

export const borderRadius = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const groupColors: Record<string, string> = {
  Bronze: colors.groupBronze,
  Silver: colors.groupSilver,
  Gold: colors.groupGold,
  Advanced: colors.groupAdvanced,
  Platinum: colors.groupPlatinum,
  Diamond: colors.groupDiamond,
};
