import type { TaskStatus } from '@fieldmate/shared';

/** Design tokens — docs/04-ui-ux.md §2. Components must not use raw values. */

export const colors = {
  // Brand and base palette (spec)
  primary: '#2563EB',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#0284C7',

  // Supporting tokens (A2)
  primaryPressed: '#1D4ED8',
  onPrimary: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  surfaceMuted: '#F1F5F9',
  textDisabled: '#94A3B8',
  overlay: 'rgba(15, 23, 42, 0.5)',

  // Accessible text-on-tint pairs (A1)
  successText: '#15803D',
  successTint: '#DCFCE7',
  warningText: '#B45309',
  warningTint: '#FEF3C7',
  infoText: '#0369A1',
  infoTint: '#E0F2FE',
  errorText: '#B91C1C',
  errorTint: '#FEE2E2',
  neutralText: '#475569',
  neutralTint: '#F1F5F9',
} as const;

export type Tone = 'info' | 'warning' | 'success' | 'error' | 'neutral';

export const toneColors: Record<Tone, { text: string; tint: string }> = {
  info: { text: colors.infoText, tint: colors.infoTint },
  warning: { text: colors.warningText, tint: colors.warningTint },
  success: { text: colors.successText, tint: colors.successTint },
  error: { text: colors.errorText, tint: colors.errorTint },
  neutral: { text: colors.neutralText, tint: colors.neutralTint },
};

/** Task status appearance (A3). Icons are Ionicons names. */
export const statusAppearance: Record<TaskStatus, { label: string; tone: Tone; icon: string }> = {
  ASSIGNED: { label: 'Assigned', tone: 'info', icon: 'mail-unread-outline' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning', icon: 'time-outline' },
  COMPLETED: { label: 'Completed', tone: 'success', icon: 'checkmark-circle-outline' },
  REJECTED: { label: 'Rejected', tone: 'error', icon: 'close-circle-outline' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', icon: 'ban-outline' },
};

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  screenTitle: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
} as const;

/** Maximum Dynamic Type scaling (docs/04-ui-ux.md §2.3). */
export const MAX_FONT_SIZE_MULTIPLIER = 1.6;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
} as const;

export const layout = {
  screenPadding: spacing.md,
  minTouchTarget: 48,
  buttonHeightLarge: 52,
  buttonHeightMedium: 48,
  inputHeight: 48,
} as const;

export const radius = {
  control: 8,
  card: 12,
  sheet: 16,
  pill: 999,
} as const;
