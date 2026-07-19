export const fontFamilies = {
  editorial: "'DM Serif Display', Georgia, serif",
  interface: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  numeric: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extraBold: 800,
} as const;

export interface TypographyRole {
  readonly fontFamily: keyof typeof fontFamilies;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: (typeof fontWeights)[keyof typeof fontWeights];
  readonly letterSpacing: number;
}

export const mobileTypography = {
  displayLarge: {
    fontFamily: 'editorial',
    fontSize: 40,
    lineHeight: 48,
    fontWeight: fontWeights.regular,
    letterSpacing: -0.4,
  },
  displayMedium: {
    fontFamily: 'editorial',
    fontSize: 32,
    lineHeight: 40,
    fontWeight: fontWeights.regular,
    letterSpacing: -0.2,
  },
  headlineLarge: {
    fontFamily: 'interface',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: fontWeights.semibold,
    letterSpacing: -0.2,
  },
  headlineMedium: {
    fontFamily: 'interface',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: fontWeights.semibold,
    letterSpacing: -0.1,
  },
  titleLarge: {
    fontFamily: 'interface',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0,
  },
  titleMedium: {
    fontFamily: 'interface',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0,
  },
  bodyLarge: {
    fontFamily: 'interface',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeights.regular,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontFamily: 'interface',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.1,
  },
  labelLarge: {
    fontFamily: 'interface',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontFamily: 'interface',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.2,
  },
  caption: {
    fontFamily: 'interface',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.2,
  },
} as const satisfies Readonly<Record<string, TypographyRole>>;

export const webTypography = {
  displayLarge: {
    fontFamily: 'editorial',
    fontSize: 64,
    lineHeight: 72,
    fontWeight: fontWeights.regular,
    letterSpacing: -0.8,
  },
  displayMedium: {
    fontFamily: 'editorial',
    fontSize: 48,
    lineHeight: 56,
    fontWeight: fontWeights.regular,
    letterSpacing: -0.5,
  },
  headlineLarge: {
    fontFamily: 'interface',
    fontSize: 36,
    lineHeight: 44,
    fontWeight: fontWeights.semibold,
    letterSpacing: -0.3,
  },
  headlineMedium: {
    fontFamily: 'interface',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: fontWeights.semibold,
    letterSpacing: -0.2,
  },
  titleLarge: {
    fontFamily: 'interface',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0,
  },
  titleMedium: {
    fontFamily: 'interface',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0,
  },
  bodyLarge: {
    fontFamily: 'interface',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: fontWeights.regular,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontFamily: 'interface',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeights.regular,
    letterSpacing: 0,
  },
  labelLarge: {
    fontFamily: 'interface',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontFamily: 'interface',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.2,
  },
  caption: {
    fontFamily: 'interface',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.2,
  },
} as const satisfies Readonly<Record<string, TypographyRole>>;

export const numericTypography = {
  fontFamily: fontFamilies.numeric,
  fontVariant: ['tabular-nums'] as const,
} as const;
