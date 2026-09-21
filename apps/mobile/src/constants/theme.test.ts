import { TASK_STATUSES } from '@fieldmate/shared';
import { colors, layout, statusAppearance, toneColors } from './theme';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe('theme tokens', () => {
  it.each(Object.entries(toneColors))(
    '%s badge text meets WCAG AA (4.5:1) on its tint',
    (_tone, pair) => {
      expect(contrast(pair.text, pair.tint)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('primary and secondary text meet WCAG AA on background and surface', () => {
    for (const bg of [colors.background, colors.surface]) {
      expect(contrast(colors.textPrimary, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('button labels meet WCAG AA on primary and error buttons', () => {
    expect(contrast(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.onPrimary, colors.primaryPressed)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.onPrimary, colors.error)).toBeGreaterThanOrEqual(4.5);
  });

  it('accent is only ever a fill: its label is readable, its own text is not', () => {
    expect(contrast(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.onAccent, colors.accentPressed)).toBeGreaterThanOrEqual(4.5);
    // Guards the rule the palette depends on — yellow text on paper is illegible.
    expect(contrast(colors.accent, colors.surface)).toBeLessThan(3);
  });

  it('text on the inverse surface meets WCAG AA', () => {
    expect(contrast(colors.textOnInverse, colors.surfaceInverse)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.textOnInverseMuted, colors.surfaceInverse)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.accent, colors.surfaceInverse)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(toneColors))(
    '%s status dot meets the 3:1 floor for meaningful graphics',
    (_tone, pair) => {
      expect(contrast(pair.dot, colors.surface)).toBeGreaterThanOrEqual(3);
    },
  );

  it('defines an appearance for every task status', () => {
    expect(Object.keys(statusAppearance).sort()).toEqual([...TASK_STATUSES].sort());
  });

  it('keeps touch targets at least 48dp', () => {
    expect(layout.minTouchTarget).toBeGreaterThanOrEqual(48);
    expect(layout.buttonHeightMedium).toBeGreaterThanOrEqual(48);
    // Raised from 52 in the redesign: the primary action is used with gloves.
    expect(layout.buttonHeightLarge).toBeGreaterThanOrEqual(56);
  });
});
