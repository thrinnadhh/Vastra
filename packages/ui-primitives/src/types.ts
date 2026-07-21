export const MOBILE_TOUCH_TARGET = {
  android: 48,
  ios: 44,
  adjacentGap: 8,
} as const;

export type PresentationMode = 'brand' | 'commerce' | 'hybrid';

export type PrimitiveStyleSlot =
  | 'action.primary.surface'
  | 'action.primary.foreground'
  | 'action.secondary.surface'
  | 'action.secondary.foreground'
  | 'action.tertiary.foreground'
  | 'action.destructive.surface'
  | 'action.destructive.foreground'
  | 'surface.background'
  | 'surface.elevated'
  | 'surface.inset'
  | 'surface.overlay'
  | 'text.primary'
  | 'text.secondary'
  | 'text.inverse'
  | 'text.disabled'
  | 'text.link'
  | 'border.default'
  | 'border.strong'
  | 'border.selected'
  | 'border.focus'
  | 'border.error'
  | 'status.success.surface'
  | 'status.success.foreground'
  | 'status.warning.surface'
  | 'status.warning.foreground'
  | 'status.danger.surface'
  | 'status.danger.foreground'
  | 'status.info.surface'
  | 'status.info.foreground'
  | 'status.neutral.surface'
  | 'status.neutral.foreground';

export type IconName =
  | 'add'
  | 'back'
  | 'cart'
  | 'check'
  | 'chevronDown'
  | 'chevronRight'
  | 'close'
  | 'discover'
  | 'edit'
  | 'error'
  | 'home'
  | 'info'
  | 'location'
  | 'menu'
  | 'orders'
  | 'profile'
  | 'retry'
  | 'search'
  | 'shop'
  | 'style'
  | 'warning';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface AccessibilityState {
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly selected: boolean;
  readonly expanded: boolean | null;
  readonly invalid: boolean;
}

export interface PrimitiveAccessibility {
  readonly label: string;
  readonly hint: string | null;
  readonly state: AccessibilityState;
}

export interface PrimitiveAction {
  readonly id: string;
  readonly label: string;
  readonly accessibilityLabel: string;
}

export interface TouchTargetContract {
  readonly android: number;
  readonly ios: number;
  readonly adjacentGap: number;
}

export function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${field} must not be empty`);
  }
  return normalized;
}

export function requireIdentifier(value: string, field: string): string {
  const normalized = requireNonEmpty(value, field);
  if (!/^[A-Za-z][A-Za-z0-9._:-]*$/u.test(normalized)) {
    throw new Error(`${field} must be a stable identifier`);
  }
  return normalized;
}

export function createAccessibilityState(
  overrides: Partial<AccessibilityState> = {},
): AccessibilityState {
  return {
    disabled: false,
    busy: false,
    selected: false,
    expanded: null,
    invalid: false,
    ...overrides,
  };
}
