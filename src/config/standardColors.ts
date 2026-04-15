import { colors } from './theme';
import type { StandardLevel } from '../types/firestore.types';

export const standardColors: Record<StandardLevel, string> = {
  B: colors.textSecondary,
  BB: colors.purpleLight,
  A: colors.accent,
  AA: colors.gold,
  AAA: colors.goldDark,
  AAAA: colors.purple,
};

export const standardBgColors: Record<StandardLevel, string> = {
  B: 'rgba(122, 122, 142, 0.12)',
  BB: 'rgba(123, 63, 160, 0.15)',
  A: 'rgba(179, 136, 255, 0.15)',
  AA: 'rgba(255, 215, 0, 0.15)',
  AAA: 'rgba(204, 176, 0, 0.18)',
  AAAA: 'rgba(74, 14, 120, 0.25)',
};

export const standardBorderColors: Record<StandardLevel, string> = {
  B: colors.textSecondary,
  BB: colors.purpleLight,
  A: colors.accent,
  AA: colors.gold,
  AAA: colors.goldDark,
  AAAA: colors.gold,
};
