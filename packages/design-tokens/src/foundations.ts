export const fontFamilies = {
  mobile: ['Inter', 'System'],
  web: ['Inter', 'system-ui', 'sans-serif'],
  monospace: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const typography = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.4,
  },
  heading1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.2,
  },
  heading2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: fontWeights.bold,
    letterSpacing: 0,
  },
  heading3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0,
  },
  title: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: fontWeights.regular,
    letterSpacing: 0,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: fontWeights.regular,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: fontWeights.regular,
    letterSpacing: 0.1,
  },
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.1,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.1,
  },
} as const;

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
} as const;

export const shape = {
  radiusSmall: 8,
  radiusMedium: 12,
  radiusLarge: 16,
  radiusExtraLarge: 24,
  radiusPill: 999,
  borderThin: 1,
  borderStrong: 2,
} as const;

export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    androidElevation: 0,
  },
  low: {
    shadowColor: '#0B1028',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    androidElevation: 2,
  },
  medium: {
    shadowColor: '#0B1028',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffsetX: 0,
    shadowOffsetY: 6,
    androidElevation: 6,
  },
  high: {
    shadowColor: '#0B1028',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffsetX: 0,
    shadowOffsetY: 12,
    androidElevation: 12,
  },
} as const;

export const motion = {
  duration: {
    instant: 0,
    fast: 120,
    standard: 200,
    deliberate: 320,
    brandMoment: 520,
    maximumNonBlocking: 700,
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1.2)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  reduced: {
    duration: 0,
    allowOpacity: true,
    allowTransformTravel: false,
    allowParallax: false,
    allowStagger: false,
  },
  constraints: {
    animateTransformAndOpacityOnly: true,
    launchAnimationMustBlockSession: false,
    operationalDecorationAllowed: false,
  },
} as const;

export const breakpoints = {
  compact: 0,
  medium: 600,
  expanded: 1024,
  wide: 1440,
} as const;

export const layout = {
  mobileGutter: 16,
  tabletGutter: 24,
  desktopGutter: 32,
  maxCommerceContentWidth: 1280,
  maxReadingWidth: 720,
  maxDialogWidth: 560,
  productImageAspectRatio: 0.75,
  editorialImageAspectRatio: 1.5,
  cardMediaAspectRatio: 0.8,
  targetGapMinimum: 8,
  stickyActionSafeInset: 16,
  zIndex: {
    base: 0,
    sticky: 10,
    overlay: 20,
    modal: 30,
    toast: 40,
  },
} as const;

export const iconography = {
  sizes: {
    compact: 16,
    standard: 20,
    action: 24,
    prominent: 32,
  },
  strokeWidth: {
    standard: 1.75,
    prominent: 2,
  },
  rules: {
    structuralEmojiAllowed: false,
    decorativeEmojiAllowed: false,
    meaningfulIconsRequireLabel: true,
    decorativeIconsHiddenFromAccessibility: true,
    statusMustIncludeText: true,
  },
} as const;

export const components = {
  touchTarget: {
    androidMinimum: 48,
    iosMinimum: 44,
    webMinimum: 44,
    adjacentMinimumGap: 8,
  },
  button: {
    minimumHeight: 48,
    horizontalPadding: 20,
    iconGap: 8,
    busyDisablesRepeatSubmission: true,
  },
  field: {
    minimumHeight: 48,
    horizontalPadding: 14,
    retainedAfterRecoverableFailure: true,
  },
  card: {
    minimumPadding: 12,
    standardPadding: 16,
    mediaRadius: 12,
  },
  bottomNavigation: {
    maximumDestinations: 5,
    minimumHeight: 64,
    labelsRequired: true,
  },
  dialog: {
    minimumActionHeight: 48,
    destructiveConfirmationRequired: true,
  },
  toast: {
    minimumVisibleDuration: 3000,
    maximumVisibleDuration: 8000,
  },
} as const;

export const foundations = {
  fontFamilies,
  fontWeights,
  typography,
  spacing,
  shape,
  elevation,
  motion,
  breakpoints,
  layout,
  iconography,
  components,
} as const;

export type DesignFoundations = typeof foundations;
