import {
  colorThemes,
  darkColorRoles,
  darkSemanticColors,
  lightColorRoles,
  lightSemanticColors,
} from './colors.js';
import { foundations } from './foundations.js';
import {
  assetRequirements,
  ornamentContracts,
  presentationModes,
  shellContracts,
  standardScreenStates,
} from './presentation.js';

export const themes = {
  light: {
    name: 'light',
    semanticColors: lightSemanticColors,
    colorRoles: lightColorRoles,
    foundations,
    presentationModes,
    ornamentContracts,
    assetRequirements,
    shellContracts,
    standardScreenStates,
  },
  dark: {
    name: 'dark',
    semanticColors: darkSemanticColors,
    colorRoles: darkColorRoles,
    foundations,
    presentationModes,
    ornamentContracts,
    assetRequirements,
    shellContracts,
    standardScreenStates,
  },
} as const;

export type ThemeName = keyof typeof themes;
export type VastraTheme = (typeof themes)[ThemeName];

export const designTokens = {
  colors: colorThemes,
  foundations,
  presentationModes,
  ornamentContracts,
  assetRequirements,
  shellContracts,
  standardScreenStates,
  themes,
} as const;
