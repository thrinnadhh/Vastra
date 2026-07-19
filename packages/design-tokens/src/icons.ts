export const iconSizes = {
  small: 16,
  medium: 20,
  standard: 24,
  large: 32,
} as const;

export const iconStrokeWidths = {
  standard: 2,
  emphasis: 2.25,
} as const;

export const iconPolicy = {
  structuralEmojiAllowed: false,
  vectorAssetsOnly: true,
  accessibilityLabelRequiredForIconOnlyControl: true,
  consistentFamilyPerVisualLayer: true,
  activeNavigationMayUseFilledCounterpart: true,
} as const;
