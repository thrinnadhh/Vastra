export const breakpoints = {
  compact: 0,
  phone: 375,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export const contentWidths = {
  reading: 720,
  form: 640,
  dashboard: 1180,
  commerce: 1280,
  immersive: 1440,
} as const;

export const aspectRatios = {
  productCard: 4 / 5,
  productDetail: 3 / 4,
  shopHero: 16 / 9,
  editorialBanner: 16 / 7,
  avatar: 1,
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 20,
  dropdown: 40,
  overlay: 100,
  modal: 1000,
  toast: 1100,
} as const;

export const navigationLimits = {
  maximumBottomNavigationItems: 5,
  maximumPrimaryActionsPerScreen: 1,
} as const;

export const imagePolicy = {
  webPreferredFormats: ['avif', 'webp'] as const,
  lazyLoadBelowFold: true,
  reserveAspectRatio: true,
  maximumProductBadges: 2,
} as const;
