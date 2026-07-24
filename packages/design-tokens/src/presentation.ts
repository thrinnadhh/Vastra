export const presentationModeNames = ['brand', 'commerce', 'hybrid'] as const;
export type PresentationModeName = (typeof presentationModeNames)[number];

export interface PresentationModeContract {
  readonly decorationIntensity: 'none' | 'restrained' | 'expressive';
  readonly backgroundTreatment: 'neutral' | 'cosmic' | 'commerce-with-brand-slots';
  readonly headingTreatment: 'functional' | 'editorial';
  readonly motionTreatment: 'operational' | 'brand-bounded' | 'hybrid-bounded';
  readonly maxOrnamentFamilies: 0 | 1 | 2;
  readonly maxBrandMoments: 0 | 1 | 2;
  readonly productContentMustDominate: true;
  readonly reducedMotionStatic: true;
}

export const presentationModes = {
  brand: {
    decorationIntensity: 'expressive',
    backgroundTreatment: 'cosmic',
    headingTreatment: 'editorial',
    motionTreatment: 'brand-bounded',
    maxOrnamentFamilies: 2,
    maxBrandMoments: 1,
    productContentMustDominate: true,
    reducedMotionStatic: true,
  },
  commerce: {
    decorationIntensity: 'none',
    backgroundTreatment: 'neutral',
    headingTreatment: 'functional',
    motionTreatment: 'operational',
    maxOrnamentFamilies: 0,
    maxBrandMoments: 0,
    productContentMustDominate: true,
    reducedMotionStatic: true,
  },
  hybrid: {
    decorationIntensity: 'restrained',
    backgroundTreatment: 'commerce-with-brand-slots',
    headingTreatment: 'functional',
    motionTreatment: 'hybrid-bounded',
    maxOrnamentFamilies: 1,
    maxBrandMoments: 2,
    productContentMustDominate: true,
    reducedMotionStatic: true,
  },
} as const satisfies Record<PresentationModeName, PresentationModeContract>;

export const ornamentNames = [
  'archFrame',
  'fluteDivider',
  'peacockAccent',
  'textilePattern',
  'cosmicSprinkle',
  'editorialHero',
  'trustStrip',
] as const;
export type OrnamentName = (typeof ornamentNames)[number];

export interface OrnamentContract {
  readonly allowedModes: readonly PresentationModeName[];
  readonly maximumPerScreen: 1 | 2;
  readonly hiddenFromAccessibility: true;
  readonly reducedMotionVariant: 'static';
  readonly mayObscureProductMedia: false;
  readonly mayObscureTextOrControls: false;
  readonly use: string;
  readonly prohibitedUse: string;
}

export const ornamentContracts = {
  archFrame: {
    allowedModes: ['brand', 'hybrid'],
    maximumPerScreen: 1,
    hiddenFromAccessibility: true,
    reducedMotionVariant: 'static',
    mayObscureProductMedia: false,
    mayObscureTextOrControls: false,
    use: 'Launch or editorial framing.',
    prohibitedUse: 'Repeated commerce cards, controls, forms, or operational status.',
  },
  fluteDivider: {
    allowedModes: ['brand', 'hybrid'],
    maximumPerScreen: 1,
    hiddenFromAccessibility: true,
    reducedMotionVariant: 'static',
    mayObscureProductMedia: false,
    mayObscureTextOrControls: false,
    use: 'A single transition between Brand content regions.',
    prohibitedUse: 'Form separation, status indication, or repeated list decoration.',
  },
  peacockAccent: {
    allowedModes: ['brand', 'hybrid'],
    maximumPerScreen: 1,
    hiddenFromAccessibility: true,
    reducedMotionVariant: 'static',
    mayObscureProductMedia: false,
    mayObscureTextOrControls: false,
    use: 'A compact Brand highlight.',
    prohibitedUse: 'Button replacement, structural icon, or repeated card decoration.',
  },
  textilePattern: {
    allowedModes: ['brand', 'hybrid'],
    maximumPerScreen: 1,
    hiddenFromAccessibility: true,
    reducedMotionVariant: 'static',
    mayObscureProductMedia: false,
    mayObscureTextOrControls: false,
    use: 'A low-contrast background crop outside critical content.',
    prohibitedUse: 'Behind body text, product details, prices, or status information.',
  },
  cosmicSprinkle: {
    allowedModes: ['brand'],
    maximumPerScreen: 1,
    hiddenFromAccessibility: true,
    reducedMotionVariant: 'static',
    mayObscureProductMedia: false,
    mayObscureTextOrControls: false,
    use: 'Confirmation or celebration.',
    prohibitedUse: 'Operational, error, repeated list, or dense commerce UI.',
  },
  editorialHero: {
    allowedModes: ['brand', 'hybrid'],
    maximumPerScreen: 1,
    hiddenFromAccessibility: true,
    reducedMotionVariant: 'static',
    mayObscureProductMedia: false,
    mayObscureTextOrControls: false,
    use: 'Home or collection campaign content.',
    prohibitedUse: 'Blocking launch, unbounded carousel, or repeated product grid content.',
  },
  trustStrip: {
    allowedModes: ['commerce', 'hybrid'],
    maximumPerScreen: 1,
    hiddenFromAccessibility: true,
    reducedMotionVariant: 'static',
    mayObscureProductMedia: false,
    mayObscureTextOrControls: false,
    use: 'Verified service or commerce facts.',
    prohibitedUse: 'Unsupported marketing claims or decorative filler.',
  },
} as const satisfies Record<OrnamentName, OrnamentContract>;

export const assetSlotNames = [
  'openingIllustration',
  'horizontalWordmark',
  'compactMark',
  'notificationMark',
  'appIcon',
  'favicon',
] as const;
export type AssetSlotName = (typeof assetSlotNames)[number];

export interface AssetRequirement {
  readonly approvalStatus: 'required-not-supplied';
  readonly sourceFormats: readonly ('SVG' | 'PNG' | 'WEBP')[];
  readonly usage: string;
  readonly prohibitedUse: string;
  readonly accessibility: 'decorative' | 'meaningful-with-alt-text' | 'system';
  readonly optimization: string;
}

export const assetRequirements = {
  openingIllustration: {
    approvalStatus: 'required-not-supplied',
    sourceFormats: ['SVG', 'WEBP'],
    usage: 'Launch and selected editorial Brand moments.',
    prohibitedUse: 'Compact application chrome or blocking session bootstrap.',
    accessibility: 'decorative',
    optimization: 'Provide bounded responsive exports and a static reduced-motion form.',
  },
  horizontalWordmark: {
    approvalStatus: 'required-not-supplied',
    sourceFormats: ['SVG', 'PNG'],
    usage: 'Large headers and approved marketing contexts.',
    prohibitedUse: 'Notification icons or compact navigation chrome.',
    accessibility: 'meaningful-with-alt-text',
    optimization: 'Prefer SVG; provide light, dark, and monochrome-safe variants.',
  },
  compactMark: {
    approvalStatus: 'required-not-supplied',
    sourceFormats: ['SVG', 'PNG'],
    usage: 'Application chrome and compact branded contexts.',
    prohibitedUse: 'Substitution for the full wordmark when the name is required.',
    accessibility: 'decorative',
    optimization: 'Provide crisp exports for compact high-density displays.',
  },
  notificationMark: {
    approvalStatus: 'required-not-supplied',
    sourceFormats: ['SVG', 'PNG'],
    usage: 'Monochrome system notification contexts.',
    prohibitedUse: 'Full-colour illustration or text-bearing wordmark.',
    accessibility: 'system',
    optimization: 'Single-colour transparent-background export with platform-safe padding.',
  },
  appIcon: {
    approvalStatus: 'required-not-supplied',
    sourceFormats: ['SVG', 'PNG'],
    usage: 'Android and iOS application icon sets.',
    prohibitedUse: 'Unapproved text or unsafe edge-to-edge detail.',
    accessibility: 'system',
    optimization: 'Export platform-required sizes from one approved master.',
  },
  favicon: {
    approvalStatus: 'required-not-supplied',
    sourceFormats: ['SVG', 'PNG'],
    usage: 'Approved web surfaces only.',
    prohibitedUse: 'Claiming a separate customer website before scope approval.',
    accessibility: 'system',
    optimization: 'Provide SVG plus standard small raster fallbacks.',
  },
} as const satisfies Record<AssetSlotName, AssetRequirement>;

export const shellNames = ['brandExperience', 'commerceScreen', 'hybridScreen'] as const;
export type ShellName = (typeof shellNames)[number];

export interface ShellContract {
  readonly presentationMode: PresentationModeName;
  readonly safeAreaAware: true;
  readonly keyboardAware: true;
  readonly contentReadableBeforeMediaLoads: true;
  readonly oneDominantPrimaryAction: true;
  readonly reducedMotionStatic: true;
  readonly scrollingContentAvoidsNavigationAndStickyActions: true;
  readonly supportsStandardRecoveryStates: true;
  readonly maximumBrandSlots: 0 | 1 | 2;
  readonly operationalDecorationAllowed: false;
}

export const shellContracts = {
  brandExperience: {
    presentationMode: 'brand',
    safeAreaAware: true,
    keyboardAware: true,
    contentReadableBeforeMediaLoads: true,
    oneDominantPrimaryAction: true,
    reducedMotionStatic: true,
    scrollingContentAvoidsNavigationAndStickyActions: true,
    supportsStandardRecoveryStates: true,
    maximumBrandSlots: 1,
    operationalDecorationAllowed: false,
  },
  commerceScreen: {
    presentationMode: 'commerce',
    safeAreaAware: true,
    keyboardAware: true,
    contentReadableBeforeMediaLoads: true,
    oneDominantPrimaryAction: true,
    reducedMotionStatic: true,
    scrollingContentAvoidsNavigationAndStickyActions: true,
    supportsStandardRecoveryStates: true,
    maximumBrandSlots: 0,
    operationalDecorationAllowed: false,
  },
  hybridScreen: {
    presentationMode: 'hybrid',
    safeAreaAware: true,
    keyboardAware: true,
    contentReadableBeforeMediaLoads: true,
    oneDominantPrimaryAction: true,
    reducedMotionStatic: true,
    scrollingContentAvoidsNavigationAndStickyActions: true,
    supportsStandardRecoveryStates: true,
    maximumBrandSlots: 2,
    operationalDecorationAllowed: false,
  },
} as const satisfies Record<ShellName, ShellContract>;

export const standardScreenStates = [
  'loading',
  'success',
  'empty',
  'recoverableError',
  'offline',
  'stale',
  'permissionDenied',
  'sessionExpired',
] as const;

export const presentationContracts = {
  modes: presentationModes,
  ornaments: ornamentContracts,
  assets: assetRequirements,
  shells: shellContracts,
  standardScreenStates,
} as const;
