import type { Ionicons } from '@expo/vector-icons';
import type { TextStyle, ViewStyle } from 'react-native';
import type { TaskStatus } from '@fieldmate/shared';

/**
 * Design tokens: "Ink & Signal". Near-black ink on warm paper, with one
 * hi-vis signal yellow reserved for "what do I do next". Components must not
 * use raw values.
 */

export type IconName = keyof typeof Ionicons.glyphMap;

export const colors = {
  /**
   * Ink. `primary` is the interactive *text* colour â€” links, focus rings,
   * spinners, ghost labels â€” and the fill of an ordinary primary button.
   */
  primary: '#0F1115',
  primaryPressed: '#2A2D33',
  onPrimary: '#FFFFFF',

  /**
   * Signal yellow: kept for the worker's next journey step, the selected tab
   * and focus glow. A FILL only â€” yellow text fails contrast on every light
   * surface, so the system never allows it.
   */
  accent: '#FFC21A',
  accentPressed: '#E8A800',
  onAccent: '#0F1115',

  /** Paper. */
  background: '#F4F3EF',
  /**
   * Only ever seen in a browser window wider than the app column, behind it.
   * A shade deeper than `background` so the column reads as the app rather
   * than as a page that failed to fill the screen.
   */
  pageBackdrop: '#E2DFD7',
  surface: '#FFFFFF',
  /** Sunken fills: search fields, tonal buttons, skeletons. */
  surfaceMuted: '#ECEAE4',
  surfaceInverse: '#0F1115',
  surfaceInverseRaised: '#1E2126',

  textPrimary: '#0F1115',
  textSecondary: '#4A4F57',
  /** Ink 3: timestamps and hints only, never key information. */
  textTertiary: '#686D76',
  textDisabled: '#8D9199',
  textOnInverse: '#FFFFFF',
  textOnInverseMuted: '#A9ADB4',

  /** Line. */
  border: '#DEDBD3',
  borderStrong: '#B9B5AB',
  borderInverse: '#2A2D33',

  /** Solid destructive fill: dark enough to carry white text at AA. */
  error: '#B42318',
  overlay: 'rgba(15, 17, 21, 0.55)',
  /** True black behind a photo or the camera, so nothing tints the image. */
  mediaBackdrop: '#000000',
  /** Controls floating over a photo or a map. */
  scrim: 'rgba(15, 17, 21, 0.55)',
  /** The offline banner: a dark amber that still reads as a warning at night. */
  offline: '#3B2E06',
  onOffline: '#FFD873',

  // Accessible text-on-tint pairs.
  successText: '#1B6B3A',
  successTint: '#DFF3E5',
  warningText: '#944700',
  warningTint: '#FDEBD3',
  infoText: '#0B5CAD',
  infoTint: '#E1EFFC',
  errorText: '#B42318',
  errorTint: '#FDE4E1',
  neutralText: '#4A4F57',
  neutralTint: '#ECEAE4',
} as const;

export type Tone = 'info' | 'warning' | 'success' | 'error' | 'neutral';

/** `dot` is the saturated mark; `text` on `tint` is the readable pairing. */
export const toneColors: Record<Tone, { text: string; tint: string; dot: string }> = {
  info: { text: colors.infoText, tint: colors.infoTint, dot: '#0B5CAD' },
  warning: { text: colors.warningText, tint: colors.warningTint, dot: '#B85A00' },
  success: { text: colors.successText, tint: colors.successTint, dot: '#1F8A4C' },
  error: { text: colors.errorText, tint: colors.errorTint, dot: '#C8291C' },
  neutral: { text: colors.neutralText, tint: colors.neutralTint, dot: '#6B7079' },
};

type StatusAppearance = {
  label: string;
  /** The family the status belongs to, for things drawn around it (avatars, tiles). */
  tone: Tone;
  icon: IconName;
  /** Each status has its own hue; `text` on `tint` is always at least 5.4:1. */
  text: string;
  tint: string;
  /** Cancelled is outlined as well, so it reads as inactive in greyscale. */
  outline?: string;
};

/**
 * Task status appearance. Every status is a colour, an icon and a word,
 * so it never depends on colour alone.
 */
export const statusAppearance: Record<TaskStatus, StatusAppearance> = {
  ASSIGNED: {
    label: 'Assigned',
    tone: 'neutral',
    icon: 'file-tray-outline',
    text: '#3F4652',
    tint: '#E8E9EC',
  },
  ACCEPTED: {
    label: 'Accepted',
    tone: 'info',
    icon: 'checkmark-circle-outline',
    text: '#2C3EC4',
    tint: '#E6E9FD',
  },
  GOING_TO_LOCATION: {
    label: 'On the way',
    tone: 'info',
    icon: 'navigate-outline',
    text: '#0B5CAD',
    tint: '#E1EFFC',
  },
  REACHED_LOCATION: {
    label: 'Arrived',
    tone: 'info',
    icon: 'location-outline',
    text: '#0B6B67',
    tint: '#DDF3F1',
  },
  IN_PROGRESS: {
    label: 'In progress',
    tone: 'warning',
    icon: 'hammer-outline',
    text: '#944700',
    tint: '#FDEBD3',
  },
  AWAITING_REVIEW: {
    label: 'Awaiting review',
    tone: 'info',
    icon: 'hourglass-outline',
    text: '#6B2FBF',
    tint: '#EFE6FD',
  },
  COMPLETED: {
    label: 'Completed',
    tone: 'success',
    icon: 'checkmark-done-outline',
    text: '#1B6B3A',
    tint: '#DFF3E5',
  },
  REJECTED: {
    label: 'Rejected',
    tone: 'error',
    icon: 'arrow-undo-outline',
    text: '#B42318',
    tint: '#FDE4E1',
  },
  CANCELLED: {
    label: 'Cancelled',
    tone: 'neutral',
    icon: 'ban-outline',
    text: '#4A4F57',
    tint: '#ECEAE4',
    outline: '#9A9EA5',
  },
};

/**
 * Geist, and Geist Mono for figures. React Native cannot synthesise weights
 * for a custom family, so each weight is its own `fontFamily` and
 * `fontWeight` is never used alongside it. The scale tops out at 700;
 * `extrabold` is kept as a name and resolves to it.
 */
export const fontFamily = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  extrabold: 'Geist_700Bold',
  mono: 'GeistMono_500Medium',
} as const;

export const typography = {
  /** Display: the dashboard greeting. */
  hero: { fontSize: 34, lineHeight: 40, fontFamily: fontFamily.bold, letterSpacing: -1 },
  /** Title 1. */
  display: { fontSize: 28, lineHeight: 34, fontFamily: fontFamily.bold, letterSpacing: -0.7 },
  screenTitle: { fontSize: 28, lineHeight: 34, fontFamily: fontFamily.bold, letterSpacing: -0.7 },
  /** Title 2. */
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fontFamily.semibold,
    letterSpacing: -0.4,
  },
  /** Headline. */
  cardTitle: { fontSize: 18, lineHeight: 24, fontFamily: fontFamily.semibold, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.semibold },
  secondary: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular },
  /** Label. */
  secondaryStrong: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.semibold },
  /** Nothing in the system is smaller than 13. */
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.medium },
  /** Small all-caps section marker. */
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontFamily.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  /** Times, counts and IDs. */
  mono: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.mono },
  button: { fontSize: 17, lineHeight: 22, fontFamily: fontFamily.semibold, letterSpacing: -0.2 },
  buttonMedium: { fontSize: 16, lineHeight: 20, fontFamily: fontFamily.semibold },
} as const satisfies Record<string, TextStyle>;

/** Figures that change in place (timers, counts) must not shift width. */
export const tabularNumbers = { fontVariant: ['tabular-nums'] } as const satisfies TextStyle;

/** Maximum Dynamic Type scaling. */
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
  /** Between sections of a screen. */
  section: 28,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
} as const;

export const layout = {
  screenPadding: spacing.mdPlus,
  minTouchTarget: 48,
  buttonHeightLarge: 56,
  buttonHeightMedium: 48,
  inputHeight: 56,
  /** Chips draw at 40 and keep a 48 hit area. */
  chipHeight: 40,
  /**
   * The app is laid out as a single column. On a phone or tablet it is simply
   * the screen, but a desktop browser is far wider than any screen the design
   * was drawn for, so the column stops here and centres instead of stretching.
   */
  maxContentWidth: 560,
  /** A form reads badly long before a list does, so it stops sooner. */
  maxFormWidth: 420,
  /** Floating tab bar, plus the gap it leaves above the safe area. */
  tabBarHeight: 72,
  tabBarInset: spacing.mdPlus,
} as const;

export const radius = {
  badge: 8,
  /** Inputs. */
  control: 12,
  /** Buttons and the action bar. */
  action: 14,
  card: 20,
  sheet: 28,
  pill: 999,
} as const;

/**
 * E1â€“E3. Wide and soft, never dark: a tight black shadow reads as a rendering
 * bug in sunlight. Lists sit flat on a line (E0) and need no token.
 */
export const elevation = {
  card: {
    shadowColor: '#0F1115',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  floating: {
    shadowColor: '#0F1115',
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  overlay: {
    shadowColor: '#0F1115',
    shadowOpacity: 0.22,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 20 },
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
