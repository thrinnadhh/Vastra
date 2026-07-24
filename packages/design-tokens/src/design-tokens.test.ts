import { describe, expect, it } from 'vitest';

import {
  assetRequirements,
  assetSlotNames,
  colorThemes,
  darkColorRoles,
  darkSemanticColors,
  lightColorRoles,
  lightSemanticColors,
  ornamentContracts,
  ornamentNames,
  presentationModeNames,
  presentationModes,
  semanticColorNames,
  shellContracts,
  shellNames,
  themes,
} from './index.js';

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return (
    0.2126 * channelToLinear(red) +
    0.7152 * channelToLinear(green) +
    0.0722 * channelToLinear(blue)
  );
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function sortedKeys(value: object): string[] {
  return Object.keys(value).sort();
}

describe('FE-S1R colour system', () => {
  it('keeps every legacy semantic key in both themes', () => {
    expect(sortedKeys(lightSemanticColors)).toEqual([...semanticColorNames].sort());
    expect(sortedKeys(darkSemanticColors)).toEqual([...semanticColorNames].sort());
  });

  it('keeps light and dark role structures aligned', () => {
    expect(sortedKeys(lightColorRoles)).toEqual(sortedKeys(darkColorRoles));

    for (const role of sortedKeys(lightColorRoles)) {
      const lightRole = lightColorRoles[role as keyof typeof lightColorRoles];
      const darkRole = darkColorRoles[role as keyof typeof darkColorRoles];
      expect(sortedKeys(lightRole)).toEqual(sortedKeys(darkRole));
    }
  });

  it.each([
    ['light body', lightColorRoles.text.primary, lightColorRoles.surface.background],
    ['light surface', lightColorRoles.text.primary, lightColorRoles.surface.raised],
    ['light primary action', lightColorRoles.action.onPrimary, lightColorRoles.action.primary],
    [
      'light brand foreground',
      lightColorRoles.brand.foregroundPrimary,
      lightColorRoles.brand.backgroundPrimary,
    ],
    [
      'light information action',
      lightColorRoles.information.onForeground,
      lightColorRoles.information.foreground,
    ],
    [
      'light success action',
      lightColorRoles.success.onForeground,
      lightColorRoles.success.foreground,
    ],
    ['dark body', darkColorRoles.text.primary, darkColorRoles.surface.background],
    ['dark primary action', darkColorRoles.action.onPrimary, darkColorRoles.action.primary],
    [
      'dark brand foreground',
      darkColorRoles.brand.foregroundPrimary,
      darkColorRoles.brand.backgroundPrimary,
    ],
  ])('%s meets normal-text WCAG AA contrast', (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('reserves gold for premium and trust accents, not small body copy', () => {
    expect(lightColorRoles.premium.smallBodyTextAllowed).toBe(false);
    expect(darkColorRoles.premium.smallBodyTextAllowed).toBe(false);
  });

  it('composes complete light and dark themes', () => {
    expect(colorThemes.light.semantic).toBe(lightSemanticColors);
    expect(colorThemes.dark.semantic).toBe(darkSemanticColors);
    expect(themes.light.name).toBe('light');
    expect(themes.dark.name).toBe('dark');
  });
});

describe('FE-S1R presentation modes', () => {
  it('permits exactly Brand, Commerce, and Hybrid', () => {
    expect(sortedKeys(presentationModes)).toEqual([...presentationModeNames].sort());
    expect(presentationModeNames).toEqual(['brand', 'commerce', 'hybrid']);
  });

  it('keeps Commerce operational and Hybrid bounded', () => {
    expect(presentationModes.commerce.maxOrnamentFamilies).toBe(0);
    expect(presentationModes.commerce.maxBrandMoments).toBe(0);
    expect(presentationModes.hybrid.maxBrandMoments).toBeLessThanOrEqual(2);
    expect(presentationModes.brand.reducedMotionStatic).toBe(true);
  });
});

describe('FE-S1R ornament, asset, and shell contracts', () => {
  it('makes every ornament decorative, bounded, and non-obscuring', () => {
    expect(sortedKeys(ornamentContracts)).toEqual([...ornamentNames].sort());

    for (const ornament of Object.values(ornamentContracts)) {
      expect(ornament.hiddenFromAccessibility).toBe(true);
      expect(ornament.reducedMotionVariant).toBe('static');
      expect(ornament.mayObscureProductMedia).toBe(false);
      expect(ornament.mayObscureTextOrControls).toBe(false);
    }
  });

  it('reserves all required asset slots without fabricating binaries', () => {
    expect(sortedKeys(assetRequirements)).toEqual([...assetSlotNames].sort());

    for (const requirement of Object.values(assetRequirements)) {
      expect(requirement.approvalStatus).toBe('required-not-supplied');
      expect(requirement.sourceFormats.length).toBeGreaterThan(0);
    }
  });

  it('defines all three shell contracts with safe recovery behavior', () => {
    expect(sortedKeys(shellContracts)).toEqual([...shellNames].sort());

    for (const shell of Object.values(shellContracts)) {
      expect(shell.safeAreaAware).toBe(true);
      expect(shell.keyboardAware).toBe(true);
      expect(shell.oneDominantPrimaryAction).toBe(true);
      expect(shell.supportsStandardRecoveryStates).toBe(true);
      expect(shell.operationalDecorationAllowed).toBe(false);
    }
  });
});
