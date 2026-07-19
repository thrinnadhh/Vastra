export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const sectionSpacing = {
  compact: spacing[4],
  standard: spacing[6],
  spacious: spacing[8],
  editorial: spacing[12],
  immersive: spacing[16],
} as const;

export const pageGutters = {
  compactPhone: spacing[4],
  phone: spacing[5],
  tablet: spacing[8],
  desktop: spacing[10],
  wide: spacing[16],
} as const;

export const touchTarget = {
  iosMinimum: 44,
  androidMinimum: 48,
  minimumGap: spacing[2],
} as const;

export type SpacingToken = keyof typeof spacing;
