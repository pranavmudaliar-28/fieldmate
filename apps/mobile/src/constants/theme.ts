import type { Ionicons } from '@expo/vector-icons';
import type { TextStyle, ViewStyle } from 'react-native';
import type { TaskStatus } from '@fieldmate/shared';

/** Design tokens — docs/04-ui-ux.md §2. Components must not use raw values. */

export type IconName = keyof typeof Ionicons.glyphMap;

export const colors = {
  /**
   * Ink, not blue. `primary` is the interactive *text* colour — links, focus
   * rings, spinners, ghost labels — so it has to stay readable on paper.
   */
  primary: '#0E1116',
  primaryPressed: '#232932',
  onPrimary: '#FFFFFF',

  /**
   * High-visibility yellow: the one action colour, used as a FILL only. Yellow
   * text fails contrast on every light surface, so the system never allows it.
   */
  accent: '#D6F24B',
  accentPressed: '#C2DE36',
  onAccent: '#0E1116',

  background: '#F5F6F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EFF1F5',
  surfaceInverse: '#0E1116',
  surfaceInverseRaised: '#1C2029',

  textPrimary: '#0E1116',
  textSecondary: '#5A6473',
  textDisabled: '#A8B0BC',
  textOnInverse: '#FFFFFF',
  textOnInverseMuted: '#8A93A2',

  border: '#E3E6EC',
  borderStrong: '#C3CAD5',
  borderInverse: '#2A3038',

  /** Solid destructive fill: dark enough to carry white text at AA. */
  error: '#CE2E48',
  overlay: 'rgba(14, 17, 22, 0.55)',

  // Accessible text-on-tint pairs (docs/04 §2.1 A1).
  successText: '#0B6B44',
  successTint: '#D6F4E6',
  warningText: '#9A5200',
  warningTint: '#FFF1DB',
  infoText: '#3A45C4',
  infoTint: '#E9EBFD',
  errorText: '#B0263C',
  errorTint: '#FCE4E8',
  neutralText: '#3C4453',
  neutralTint: '#EAECF0',
} as const;

export type Tone = 'info' | 'warning' | 'success' | 'error' | 'neutral';

/** `dot` is the saturated mark; `text` on `tint` is the readable pairing. */
export const toneColors: Record<Tone, { text: string; tint: string; dot: string }> = {
  info: { text: colors.infoText, tint: colors.infoTint, dot: '#4B5BD7' },
  warning: { text: colors.warningText, tint: colors.warningTint, dot: '#D07800' },
  success: { text: colors.successText, tint: colors.successTint, dot: '#10A56A' },
  error: { text: colors.errorText, tint: colors.errorTint, dot: '#DC3A55' },
  neutral: { text: colors.neutralText, tint: colors.neutralTint, dot: '#7A8496' },
};

/** Task status appearance. Icons are Ionicons names and are now rendered. */
export const statusAppearance: Record<TaskStatus, { label: string; tone: Tone; icon: IconName }> = {
  ASSIGNED: { label: 'Assigned', tone: 'info', icon: 'mail-unread-outline' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning', icon: 'time-outline' },
  COMPLETED: { label: 'Completed', tone: 'success', icon: 'checkmark-circle-outline' },
  REJECTED: { label: 'Rejected', tone: 'error', icon: 'close-circle-outline' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', icon: 'ban-outline' },
};

/**
 * Inter. React Native cannot synthesise weights for a custom family, so each
 * weight is its own `fontFamily` and `fontWeight` is never used alongside it.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const typography = {
  hero: { fontSize: 30, lineHeight: 35, fontFamily: fontFamily.extrabold, letterSpacing: -1 },
  display: { fontSize: 28, lineHeight: 33, fontFamily: fontFamily.extrabold, letterSpacing: -0.9 },
  screenTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontFamily: fontFamily.extrabold,
    letterSpacing: -0.7,
  },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontFamily: fontFamily.bold, letterSpacing: -0.3 },
  cardTitle: { fontSize: 16, lineHeight: 21, fontFamily: fontFamily.bold, letterSpacing: -0.25 },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.semibold },
  secondary: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular },
  secondaryStrong: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.semibold },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.semibold },
  /** Small all-caps section marker. */
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fontFamily.extrabold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  button: { fontSize: 16, lineHeight: 20, fontFamily: fontFamily.bold, letterSpacing: -0.2 },
} as const satisfies Record<string, TextStyle>;

/** Figures that change in place (timers, counts) must not shift width. */
export const tabularNumbers = { fontVariant: ['tabular-nums'] } as const satisfies TextStyle;

/** Maximum Dynamic Type scaling (docs/04-ui-ux.md §2.3). */
export const MAX_FONT_SIZE_MULTIPLIER = 1.6;

export const spacing = {
  xs: 4,
  sm: 8,
  /** Between cards in a list. */
  smPlus: 12,
  md: 16,
  /** Screen gutter. */
  mdPlus: 20,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
} as const;

export const layout = {
  screenPadding: spacing.mdPlus,
  minTouchTarget: 48,
  buttonHeightLarge: 60,
  buttonHeightMedium: 48,
  inputHeight: 56,
  /** Floating tab bar, plus the gap it leaves above the safe area. */
  tabBarHeight: 66,
  tabBarInset: spacing.mdPlus,
} as const;

export const radius = {
  control: 14,
  /** Primary buttons and the action bar. */
  action: 18,
  card: 22,
  sheet: 28,
  pill: 999,
} as const;

/**
 * Wide and soft, never dark: a tight black shadow reads as a rendering bug in
 * sunlight. Replaces the old border-only rule, which flattened every surface.
 */
export const elevation = {
  card: {
    shadowColor: '#0E1116',
    shadowOpacity: 0.06,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  floating: {
    shadowColor: '#0E1116',
    shadowOpacity: 0.14,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  overlay: {
    shadowColor: '#0E1116',
    shadowOpacity: 0.26,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 24 },
    elevation: 16,
  },
} as const satisfies Record<string, ViewStyle>;

/** Durations in ms. Reduce Motion swaps movement for a cross-fade. */
export const motion = {
  press: 100,
  quick: 160,
  base: 240,
  sheet: 320,
  shimmer: 1200,
} as const;
