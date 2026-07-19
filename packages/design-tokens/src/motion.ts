export const motionDuration = {
  feedbackFast: 100,
  microFast: 160,
  micro: 220,
  enter: 300,
  page: 400,
  exit: 195,
} as const;

export const motionEasing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasizedEnter: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  emphasizedExit: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  linear: 'linear',
} as const;

export const motionDistance = {
  subtle: 4,
  small: 8,
  medium: 16,
  large: 24,
} as const;

export const motionScale = {
  pressed: 0.98,
  enter: 0.96,
  neutral: 1,
} as const;

export const motionStagger = {
  fast: 30,
  standard: 45,
  maximumItems: 8,
} as const;

export const reducedMotion = {
  parallaxEnabled: false,
  largeTranslationEnabled: false,
  staggerEnabled: false,
  duration: motionDuration.feedbackFast,
  opacityFeedbackEnabled: true,
} as const;

export const motionPolicy = {
  maximumAnimatedElementsPerView: 2,
  maximumComplexTransitionDuration: motionDuration.page,
  animateLayoutProperties: false,
  allowBlockingAnimation: false,
  preferredProperties: ['transform', 'opacity'] as const,
} as const;
