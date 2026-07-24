export const primitiveColors = {
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
  cosmicNavy: {
    50: '#EEF2FF',
    100: '#DCE5FF',
    200: '#BBCBFF',
    300: '#8DA9FF',
    400: '#5E80F5',
    500: '#3F5FD6',
    600: '#3047AD',
    700: '#26398A',
    800: '#1D2B69',
    900: '#151F4D',
    950: '#0B1028',
  },
  royalBlue: {
    50: '#EEF5FF',
    100: '#D9E8FF',
    200: '#B9D4FF',
    300: '#8AB9FF',
    400: '#5798F2',
    500: '#356FC9',
    600: '#2857A6',
    700: '#214785',
    800: '#1D3A69',
    900: '#192F55',
    950: '#0E1B32',
  },
  plum: {
    50: '#FAF4FF',
    100: '#F1E4FA',
    200: '#E1C7F0',
    300: '#C89CDE',
    400: '#A96AC6',
    500: '#8A45A9',
    600: '#71368A',
    700: '#5B2B70',
    800: '#482257',
    900: '#381A43',
    950: '#23102B',
  },
  peacockTeal: {
    50: '#ECFDF8',
    100: '#D0F8ED',
    200: '#A4EFD9',
    300: '#6CDEBF',
    400: '#37C5A2',
    500: '#1B9E7E',
    600: '#147D65',
    700: '#116451',
    800: '#105043',
    900: '#0D4238',
    950: '#06251F',
  },
  magenta: {
    50: '#FFF0F7',
    100: '#FFE0F0',
    200: '#FFC1DF',
    300: '#FF91C8',
    400: '#F35B9C',
    500: '#D9367C',
    600: '#B92567',
    700: '#961E55',
    800: '#7A1D49',
    900: '#661B40',
    950: '#3C0B24',
  },
  warmGold: {
    50: '#FFF9E8',
    100: '#FFF0BF',
    200: '#FFE18A',
    300: '#F7C953',
    400: '#DCA82D',
    500: '#B98616',
    600: '#94680D',
    700: '#76510C',
    800: '#61410F',
    900: '#523712',
    950: '#2F1D07',
  },
  ivory: {
    50: '#FFF9F5',
    100: '#FDF2EA',
  },
  neutral: {
    50: '#FAFAFB',
    100: '#F4F4F6',
    200: '#E4E4E8',
    300: '#D0D0D7',
    400: '#A9A9B2',
    500: '#7C7C87',
    600: '#5F5F69',
    700: '#47474F',
    800: '#303036',
    900: '#222226',
    950: '#151518',
  },
  danger: {
    50: '#FFF1F0',
    100: '#FFE0DE',
    600: '#B42318',
    700: '#912018',
    800: '#751A14',
  },
  warning: {
    50: '#FFF8E6',
    100: '#FFEBC0',
    600: '#94600A',
    700: '#754B08',
    800: '#5C3A08',
  },
} as const;

export const semanticColorNames = [
  'background',
  'backgroundSubtle',
  'surface',
  'surfaceRaised',
  'surfaceInset',
  'surfaceInverse',
  'textPrimary',
  'textSecondary',
  'textTertiary',
  'textDisabled',
  'textInverse',
  'textLink',
  'border',
  'borderStrong',
  'borderSelected',
  'borderError',
  'primary',
  'primaryPressed',
  'primarySoft',
  'onPrimary',
  'accent',
  'accentPressed',
  'accentSoft',
  'onAccent',
  'success',
  'successSoft',
  'warning',
  'warningSoft',
  'danger',
  'dangerSoft',
  'info',
  'infoSoft',
  'premium',
  'premiumSoft',
  'focusRing',
  'scrim',
  'skeletonBase',
  'skeletonHighlight',
] as const;

export type SemanticColorName = (typeof semanticColorNames)[number];
export type SemanticColorTheme = Readonly<Record<SemanticColorName, string>>;

export interface ColorRoleTheme {
  readonly brand: {
    readonly backgroundPrimary: string;
    readonly backgroundSecondary: string;
    readonly backgroundSoft: string;
    readonly foregroundPrimary: string;
    readonly foregroundMuted: string;
    readonly accent: string;
    readonly sparkle: string;
  };
  readonly action: {
    readonly primary: string;
    readonly primaryPressed: string;
    readonly primarySoft: string;
    readonly onPrimary: string;
    readonly disabled: string;
    readonly onDisabled: string;
  };
  readonly information: {
    readonly foreground: string;
    readonly background: string;
    readonly border: string;
    readonly onForeground: string;
  };
  readonly success: {
    readonly foreground: string;
    readonly background: string;
    readonly border: string;
    readonly onForeground: string;
  };
  readonly warning: {
    readonly foreground: string;
    readonly background: string;
    readonly border: string;
    readonly onForeground: string;
  };
  readonly danger: {
    readonly foreground: string;
    readonly background: string;
    readonly border: string;
    readonly onForeground: string;
  };
  readonly premium: {
    readonly accent: string;
    readonly background: string;
    readonly foreground: string;
    readonly smallBodyTextAllowed: false;
  };
  readonly surface: {
    readonly background: string;
    readonly subtle: string;
    readonly raised: string;
    readonly inset: string;
    readonly inverse: string;
    readonly overlay: string;
  };
  readonly text: {
    readonly primary: string;
    readonly secondary: string;
    readonly tertiary: string;
    readonly disabled: string;
    readonly inverse: string;
    readonly link: string;
  };
  readonly border: {
    readonly default: string;
    readonly strong: string;
    readonly selected: string;
    readonly focus: string;
    readonly error: string;
  };
  readonly appAccent: {
    readonly customer: string;
    readonly merchant: string;
    readonly captain: string;
    readonly admin: string;
  };
}

export const lightSemanticColors = {
  background: primitiveColors.ivory[50],
  backgroundSubtle: primitiveColors.neutral[50],
  surface: primitiveColors.white,
  surfaceRaised: primitiveColors.white,
  surfaceInset: primitiveColors.neutral[100],
  surfaceInverse: primitiveColors.cosmicNavy[950],
  textPrimary: primitiveColors.neutral[950],
  textSecondary: primitiveColors.neutral[700],
  textTertiary: primitiveColors.neutral[600],
  textDisabled: primitiveColors.neutral[500],
  textInverse: primitiveColors.white,
  textLink: primitiveColors.royalBlue[700],
  border: primitiveColors.neutral[200],
  borderStrong: primitiveColors.neutral[400],
  borderSelected: primitiveColors.royalBlue[600],
  borderError: primitiveColors.danger[600],
  primary: primitiveColors.plum[600],
  primaryPressed: primitiveColors.plum[800],
  primarySoft: primitiveColors.plum[100],
  onPrimary: primitiveColors.white,
  accent: primitiveColors.magenta[600],
  accentPressed: primitiveColors.magenta[800],
  accentSoft: primitiveColors.magenta[100],
  onAccent: primitiveColors.white,
  success: primitiveColors.peacockTeal[600],
  successSoft: primitiveColors.peacockTeal[50],
  warning: primitiveColors.warning[600],
  warningSoft: primitiveColors.warning[50],
  danger: primitiveColors.danger[600],
  dangerSoft: primitiveColors.danger[50],
  info: primitiveColors.royalBlue[600],
  infoSoft: primitiveColors.royalBlue[50],
  premium: primitiveColors.warmGold[700],
  premiumSoft: primitiveColors.warmGold[50],
  focusRing: primitiveColors.royalBlue[500],
  scrim: 'rgba(11, 16, 40, 0.56)',
  skeletonBase: primitiveColors.neutral[200],
  skeletonHighlight: primitiveColors.neutral[50],
} as const satisfies SemanticColorTheme;

export const darkSemanticColors = {
  background: primitiveColors.cosmicNavy[950],
  backgroundSubtle: primitiveColors.cosmicNavy[900],
  surface: '#151A36',
  surfaceRaised: '#1C2347',
  surfaceInset: '#11162F',
  surfaceInverse: primitiveColors.ivory[50],
  textPrimary: primitiveColors.white,
  textSecondary: '#D7DCF3',
  textTertiary: '#B8C0DF',
  textDisabled: '#8992B5',
  textInverse: primitiveColors.cosmicNavy[950],
  textLink: primitiveColors.royalBlue[300],
  border: '#333D68',
  borderStrong: '#56618F',
  borderSelected: primitiveColors.royalBlue[300],
  borderError: '#F29A92',
  primary: primitiveColors.plum[300],
  primaryPressed: primitiveColors.plum[200],
  primarySoft: primitiveColors.plum[900],
  onPrimary: primitiveColors.plum[950],
  accent: primitiveColors.magenta[300],
  accentPressed: primitiveColors.magenta[200],
  accentSoft: primitiveColors.magenta[900],
  onAccent: primitiveColors.magenta[950],
  success: primitiveColors.peacockTeal[300],
  successSoft: primitiveColors.peacockTeal[950],
  warning: primitiveColors.warmGold[300],
  warningSoft: primitiveColors.warmGold[950],
  danger: '#F29A92',
  dangerSoft: '#4B2527',
  info: primitiveColors.royalBlue[300],
  infoSoft: primitiveColors.royalBlue[950],
  premium: primitiveColors.warmGold[300],
  premiumSoft: primitiveColors.warmGold[950],
  focusRing: primitiveColors.royalBlue[300],
  scrim: 'rgba(0, 0, 0, 0.68)',
  skeletonBase: '#2B345D',
  skeletonHighlight: '#3A4678',
} as const satisfies SemanticColorTheme;

export const lightColorRoles = {
  brand: {
    backgroundPrimary: primitiveColors.cosmicNavy[950],
    backgroundSecondary: primitiveColors.royalBlue[800],
    backgroundSoft: primitiveColors.royalBlue[50],
    foregroundPrimary: primitiveColors.ivory[50],
    foregroundMuted: primitiveColors.royalBlue[100],
    accent: primitiveColors.magenta[400],
    sparkle: primitiveColors.warmGold[300],
  },
  action: {
    primary: primitiveColors.plum[600],
    primaryPressed: primitiveColors.plum[800],
    primarySoft: primitiveColors.plum[100],
    onPrimary: primitiveColors.white,
    disabled: primitiveColors.neutral[200],
    onDisabled: primitiveColors.neutral[600],
  },
  information: {
    foreground: primitiveColors.royalBlue[600],
    background: primitiveColors.royalBlue[50],
    border: primitiveColors.royalBlue[300],
    onForeground: primitiveColors.white,
  },
  success: {
    foreground: primitiveColors.peacockTeal[600],
    background: primitiveColors.peacockTeal[50],
    border: primitiveColors.peacockTeal[300],
    onForeground: primitiveColors.white,
  },
  warning: {
    foreground: primitiveColors.warning[600],
    background: primitiveColors.warning[50],
    border: primitiveColors.warmGold[300],
    onForeground: primitiveColors.white,
  },
  danger: {
    foreground: primitiveColors.danger[600],
    background: primitiveColors.danger[50],
    border: '#F29A92',
    onForeground: primitiveColors.white,
  },
  premium: {
    accent: primitiveColors.warmGold[500],
    background: primitiveColors.warmGold[50],
    foreground: primitiveColors.warmGold[800],
    smallBodyTextAllowed: false,
  },
  surface: {
    background: primitiveColors.ivory[50],
    subtle: primitiveColors.neutral[50],
    raised: primitiveColors.white,
    inset: primitiveColors.neutral[100],
    inverse: primitiveColors.cosmicNavy[950],
    overlay: 'rgba(11, 16, 40, 0.56)',
  },
  text: {
    primary: primitiveColors.neutral[950],
    secondary: primitiveColors.neutral[700],
    tertiary: primitiveColors.neutral[600],
    disabled: primitiveColors.neutral[500],
    inverse: primitiveColors.white,
    link: primitiveColors.royalBlue[700],
  },
  border: {
    default: primitiveColors.neutral[200],
    strong: primitiveColors.neutral[400],
    selected: primitiveColors.royalBlue[600],
    focus: primitiveColors.royalBlue[500],
    error: primitiveColors.danger[600],
  },
  appAccent: {
    customer: primitiveColors.plum[600],
    merchant: primitiveColors.magenta[600],
    captain: primitiveColors.peacockTeal[600],
    admin: primitiveColors.royalBlue[600],
  },
} as const satisfies ColorRoleTheme;

export const darkColorRoles = {
  brand: {
    backgroundPrimary: primitiveColors.cosmicNavy[950],
    backgroundSecondary: primitiveColors.royalBlue[900],
    backgroundSoft: '#151A36',
    foregroundPrimary: primitiveColors.white,
    foregroundMuted: primitiveColors.royalBlue[100],
    accent: primitiveColors.magenta[300],
    sparkle: primitiveColors.warmGold[300],
  },
  action: {
    primary: primitiveColors.plum[300],
    primaryPressed: primitiveColors.plum[200],
    primarySoft: primitiveColors.plum[900],
    onPrimary: primitiveColors.plum[950],
    disabled: '#343B5D',
    onDisabled: '#9DA5C6',
  },
  information: {
    foreground: primitiveColors.royalBlue[300],
    background: primitiveColors.royalBlue[950],
    border: primitiveColors.royalBlue[700],
    onForeground: primitiveColors.royalBlue[950],
  },
  success: {
    foreground: primitiveColors.peacockTeal[300],
    background: primitiveColors.peacockTeal[950],
    border: primitiveColors.peacockTeal[700],
    onForeground: primitiveColors.peacockTeal[950],
  },
  warning: {
    foreground: primitiveColors.warmGold[300],
    background: primitiveColors.warmGold[950],
    border: primitiveColors.warmGold[700],
    onForeground: primitiveColors.warmGold[950],
  },
  danger: {
    foreground: '#F29A92',
    background: '#4B2527',
    border: '#B95D57',
    onForeground: primitiveColors.cosmicNavy[950],
  },
  premium: {
    accent: primitiveColors.warmGold[300],
    background: primitiveColors.warmGold[950],
    foreground: primitiveColors.warmGold[200],
    smallBodyTextAllowed: false,
  },
  surface: {
    background: primitiveColors.cosmicNavy[950],
    subtle: primitiveColors.cosmicNavy[900],
    raised: '#1C2347',
    inset: '#11162F',
    inverse: primitiveColors.ivory[50],
    overlay: 'rgba(0, 0, 0, 0.68)',
  },
  text: {
    primary: primitiveColors.white,
    secondary: '#D7DCF3',
    tertiary: '#B8C0DF',
    disabled: '#8992B5',
    inverse: primitiveColors.cosmicNavy[950],
    link: primitiveColors.royalBlue[300],
  },
  border: {
    default: '#333D68',
    strong: '#56618F',
    selected: primitiveColors.royalBlue[300],
    focus: primitiveColors.royalBlue[300],
    error: '#F29A92',
  },
  appAccent: {
    customer: primitiveColors.plum[300],
    merchant: primitiveColors.magenta[300],
    captain: primitiveColors.peacockTeal[300],
    admin: primitiveColors.royalBlue[300],
  },
} as const satisfies ColorRoleTheme;

export const colorThemes = {
  light: {
    semantic: lightSemanticColors,
    roles: lightColorRoles,
  },
  dark: {
    semantic: darkSemanticColors,
    roles: darkColorRoles,
  },
} as const;

export type ColorThemeName = keyof typeof colorThemes;
