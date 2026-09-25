import type { Status } from '@renewals/shared';

/** Design tokens. Dark theme only. */
export const colors = {
  bg: '#0F1216',
  card: '#171B21',
  border: '#242A33',
  text: '#F2EFE8',
  muted: '#9AA3AE',
  accent: '#F0A23B',
  accentText: '#1A1206',
  ringTrack: '#262C35',
  paid: '#6FDBA5',
  paidBg: 'rgba(76,195,138,0.14)',
  unpaid: '#FF8F82',
  unpaidBg: 'rgba(255,122,107,0.14)',
  pending: '#F5B55E',
  pendingBg: 'rgba(240,162,59,0.14)',
  glow: '#F0A23B',
  overlay: 'rgba(15,18,22,0.72)',
} as const;

export const statusColors: Record<Status, { fg: string; bg: string }> = {
  paid: { fg: colors.paid, bg: colors.paidBg },
  unpaid: { fg: colors.unpaid, bg: colors.unpaidBg },
  pending: { fg: colors.pending, bg: colors.pendingBg },
};

export const radius = { card: 24, row: 16, pill: 999, input: 14 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const fonts = {
  title: 'Rubik_800ExtraBold',
  titleBold: 'Rubik_700Bold',
  body: 'Assistant_400Regular',
  bodySemi: 'Assistant_600SemiBold',
  bodyBold: 'Assistant_700Bold',
} as const;

export const type = {
  screenTitle: { fontFamily: fonts.title, fontSize: 32, lineHeight: 40, color: colors.text },
  sectionTitle: { fontFamily: fonts.titleBold, fontSize: 20, lineHeight: 26, color: colors.text },
  number: { fontFamily: fonts.title, fontSize: 26, lineHeight: 32, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.text },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.text },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18, color: colors.muted },
  small: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 17, color: colors.muted },
} as const;

export const MIN_TOUCH = 44;
export const MAX_WEB_WIDTH = 560;

/** Motion durations (ms). Always 150–250; zero when reduced motion is on. */
export const motion = { press: 150, screen: 220 } as const;
