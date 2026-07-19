import { radii } from './shape';
import { spacing, touchTarget } from './spacing';

export const componentSizes = {
  button: {
    compactHeight: touchTarget.iosMinimum,
    standardHeight: touchTarget.androidMinimum,
    largeHeight: 56,
    horizontalPadding: spacing[5],
    gap: spacing[2],
    radius: radii.button,
  },
  input: {
    minimumHeight: 52,
    horizontalPadding: spacing[4],
    verticalPadding: spacing[3],
    radius: radii.input,
  },
  iconButton: {
    minimumSize: touchTarget.androidMinimum,
  },
  chip: {
    minimumHeight: 36,
    horizontalPadding: spacing[3],
    gap: spacing[1],
    radius: radii.pill,
  },
  card: {
    compactPadding: spacing[3],
    standardPadding: spacing[4],
    spaciousPadding: spacing[6],
    radius: radii.card,
  },
  bottomNavigation: {
    minimumHeight: 64,
    itemMinimumWidth: 64,
  },
  appHeader: {
    minimumHeight: 56,
  },
  modal: {
    radius: radii.modal,
    minimumHorizontalMargin: spacing[4],
  },
  sheet: {
    radius: radii.sheet,
    handleWidth: 40,
    handleHeight: 4,
  },
} as const;

export const feedbackTiming = {
  toastMinimumDuration: 3000,
  toastMaximumDuration: 5000,
  tapFeedbackMaximumLatency: 100,
  skeletonThreshold: 1000,
} as const;
