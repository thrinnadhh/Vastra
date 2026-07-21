import {
  MOBILE_TOUCH_TARGET,
  createAccessibilityState,
  requireIdentifier,
  requireNonEmpty,
  type IconName,
  type PrimitiveAccessibility,
  type PrimitiveStyleSlot,
  type TouchTargetContract,
} from './types.js';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type ButtonSize = 'compact' | 'default' | 'large';

export interface ButtonPrimitiveInput {
  readonly id: string;
  readonly label: string;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: IconName;
  readonly iconPosition?: 'leading' | 'trailing';
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly expanded?: boolean;
}

export interface ButtonPrimitive {
  readonly kind: 'button';
  readonly id: string;
  readonly label: string;
  readonly variant: ButtonVariant;
  readonly size: ButtonSize;
  readonly icon: IconName | null;
  readonly iconPosition: 'leading' | 'trailing';
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly accessibility: PrimitiveAccessibility;
  readonly minimumTouchTarget: TouchTargetContract;
  readonly styleSlots: readonly PrimitiveStyleSlot[];
}

const BUTTON_STYLE_SLOTS: Readonly<Record<ButtonVariant, readonly PrimitiveStyleSlot[]>> = {
  primary: ['action.primary.surface', 'action.primary.foreground', 'border.focus'],
  secondary: [
    'action.secondary.surface',
    'action.secondary.foreground',
    'border.default',
    'border.focus',
  ],
  tertiary: ['action.tertiary.foreground', 'border.focus'],
  destructive: ['action.destructive.surface', 'action.destructive.foreground', 'border.focus'],
};

export function createButtonPrimitive(input: ButtonPrimitiveInput): ButtonPrimitive {
  const id = requireIdentifier(input.id, 'button id');
  const label = requireNonEmpty(input.label, 'button label');
  const accessibilityLabel = requireNonEmpty(
    input.accessibilityLabel ?? label,
    'button accessibility label',
  );
  const busy = input.busy ?? false;
  const disabled = (input.disabled ?? false) || busy;
  const variant = input.variant ?? 'primary';

  return {
    kind: 'button',
    id,
    label,
    variant,
    size: input.size ?? 'default',
    icon: input.icon ?? null,
    iconPosition: input.iconPosition ?? 'leading',
    disabled,
    busy,
    accessibility: {
      label: accessibilityLabel,
      hint: input.accessibilityHint?.trim() || null,
      state: createAccessibilityState({
        disabled,
        busy,
        expanded: input.expanded ?? null,
      }),
    },
    minimumTouchTarget: MOBILE_TOUCH_TARGET,
    styleSlots: BUTTON_STYLE_SLOTS[variant],
  };
}
