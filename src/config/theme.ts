// BSPC Coach App — Power Cats Theme
//
// Source: www.bspowercats.com homepage and swim-lessons page sampled on
// 2026-05-06. Google Sites' embedded Power Cats widget exposes:
// --bg #1b163d, --bg2 #0d0a24, --gold #f5a623, --gold-dim #c4841a,
// --gold-light #fde68a, --text #fff, --text-dim #ccc. The bare domain did
// not resolve, so the canonical www host was used. Legacy purple key names
// remain as compatibility aliases, but now resolve to Power Cats orange.

export const colors = {
  // Dark Backgrounds
  bgDeep: '#0d0a24',
  bgBase: '#1b163d',
  bgElevated: '#241d4a',
  bgSurface: '#2a2360',

  // BSPC Identity
  purple: '#f5a623',
  purpleDark: '#c4841a',
  purpleLight: '#fde68a',
  purpleGlow: '#f5a623',

  // Power Cats Accents
  gold: '#FFD700',
  goldDark: '#CCB000',
  accent: '#f5a623', // primary buttons, pills, active states, links
  success: '#2FA872', // attendance confirmed, positive status

  // Semantic
  background: '#1b163d',
  surface: '#241d4a',
  surfaceElevated: '#2a2360',
  text: '#ffffff',
  textSecondary: '#cccccc',
  textInverse: '#0d0a24',
  border: '#4f474e',
  borderLight: '#2a2360',
  borderAccent: '#c4841a',

  // Status
  successLight: 'rgba(47, 168, 114, 0.12)',
  error: '#f43f5e',
  errorLight: 'rgba(244, 63, 94, 0.12)',
  warning: '#f5a623',
  warningLight: 'rgba(245, 166, 35, 0.12)',
  info: '#7dd3fc',
  infoLight: 'rgba(125, 211, 252, 0.10)',

  // Group badges
  groupBronze: '#CD7F32',
  groupSilver: '#C0C0C0',
  groupGold: '#FFD700',
  groupAdvanced: '#3B82F6',
  groupPlatinum: '#A0AEC0',
  groupDiamond: '#38BDF8',
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
