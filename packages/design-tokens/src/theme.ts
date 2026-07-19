import { colorThemes } from './colors';
import { componentSizes, feedbackTiming } from './components';
import { elevation } from './elevation';
import { iconPolicy, iconSizes, iconStrokeWidths } from './icons';
import {
  aspectRatios,
  breakpoints,
  contentWidths,
  imagePolicy,
  navigationLimits,
  zIndex,
} from './layout';
import {
  motionDistance,
  motionDuration,
  motionEasing,
  motionPolicy,
  motionScale,
  motionStagger,
  reducedMotion,
} from './motion';
import { borderWidths, radii } from './shape';
import { pageGutters, sectionSpacing, spacing, touchTarget } from './spacing';
import {
  fontFamilies,
  fontWeights,
  mobileTypography,
  numericTypography,
  webTypography,
} from './typography';

const sharedTheme = {
  spacing,
  sectionSpacing,
  pageGutters,
  touchTarget,
  radii,
  borderWidths,
  elevation,
  fonts: fontFamilies,
  fontWeights,
  typography: {
    mobile: mobileTypography,
    web: webTypography,
    numeric: numericTypography,
  },
  motion: {
    duration: motionDuration,
    easing: motionEasing,
    distance: motionDistance,
    scale: motionScale,
    stagger: motionStagger,
    reduced: reducedMotion,
    policy: motionPolicy,
  },
  icons: {
    sizes: iconSizes,
    strokeWidths: iconStrokeWidths,
    policy: iconPolicy,
  },
  layout: {
    breakpoints,
    contentWidths,
    aspectRatios,
    zIndex,
    navigationLimits,
    imagePolicy,
  },
  components: componentSizes,
  feedbackTiming,
} as const;

export const themes = {
  light: {
    ...sharedTheme,
    colors: colorThemes.light,
  },
  dark: {
    ...sharedTheme,
    colors: colorThemes.dark,
  },
} as const;

export type VastraThemeName = keyof typeof themes;
export type VastraTheme = (typeof themes)[VastraThemeName];
