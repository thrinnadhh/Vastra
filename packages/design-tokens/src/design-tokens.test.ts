import { describe, expect, it } from 'vitest';

import {
  breakpoints,
  componentSizes,
  darkColorTheme,
  iconPolicy,
  lightColorTheme,
  motionDuration,
  motionPolicy,
  semanticColorNames,
  spacing,
  themes,
  touchTarget,
} from './index';

function lineariseChannel(channel: number): number {
  const normalised = channel / 255;
  return normalised <= 0.04045 ? normalised / 12.92 : Math.pow((normalised + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const red = lineariseChannel(Number.parseInt(value.slice(0, 2), 16));
  const green = lineariseChannel(Number.parseInt(value.slice(2, 4), 16));
  const blue = lineariseChannel(Number.parseInt(value.slice(4, 6), 16));

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Vastra design tokens', () => {
  it('keeps both themes complete and aligned', () => {
    expect(Object.keys(themes.light.colors).sort()).toEqual([...semanticColorNames].sort());
    expect(Object.keys(themes.dark.colors).sort()).toEqual([...semanticColorNames].sort());
  });

  it('meets minimum text and action contrast for canonical pairs', () => {
    const pairs = [
      [lightColorTheme.textPrimary, lightColorTheme.background],
      [lightColorTheme.textSecondary, lightColorTheme.surface],
      [lightColorTheme.onPrimary, lightColorTheme.primary],
      [lightColorTheme.onAccent, lightColorTheme.accent],
      [darkColorTheme.textPrimary, darkColorTheme.background],
      [darkColorTheme.textSecondary, darkColorTheme.background],
      [darkColorTheme.onPrimary, darkColorTheme.primary],
      [darkColorTheme.onAccent, darkColorTheme.accent],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('uses a monotonic four-point spacing rhythm', () => {
    const values = Object.values(spacing);
    expect(values).toEqual([...values].sort((left, right) => left - right));

    for (const value of values) {
      expect(value % 4).toBe(0);
    }
  });

  it('preserves accessible touch targets and component heights', () => {
    expect(touchTarget.iosMinimum).toBeGreaterThanOrEqual(44);
    expect(touchTarget.androidMinimum).toBeGreaterThanOrEqual(48);
    expect(touchTarget.minimumGap).toBeGreaterThanOrEqual(8);
    expect(componentSizes.button.standardHeight).toBeGreaterThanOrEqual(48);
    expect(componentSizes.input.minimumHeight).toBeGreaterThanOrEqual(48);
    expect(componentSizes.iconButton.minimumSize).toBeGreaterThanOrEqual(48);
  });

  it('keeps responsive breakpoints ordered', () => {
    const values = Object.values(breakpoints);
    expect(values).toEqual([...values].sort((left, right) => left - right));
  });

  it('keeps motion responsive and non-blocking', () => {
    expect(motionDuration.feedbackFast).toBeLessThanOrEqual(120);
    expect(motionDuration.micro).toBeLessThanOrEqual(300);
    expect(motionDuration.page).toBeLessThanOrEqual(400);
    expect(motionDuration.exit).toBeLessThan(motionDuration.enter);
    expect(motionPolicy.animateLayoutProperties).toBe(false);
    expect(motionPolicy.allowBlockingAnimation).toBe(false);
  });

  it('prohibits emoji as structural icons', () => {
    expect(iconPolicy.structuralEmojiAllowed).toBe(false);
    expect(iconPolicy.vectorAssetsOnly).toBe(true);
    expect(iconPolicy.accessibilityLabelRequiredForIconOnlyControl).toBe(true);
  });
});
