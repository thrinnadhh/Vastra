import {
  MOBILE_TOUCH_TARGET,
  createAccessibilityState,
  requireIdentifier,
  requireNonEmpty,
  type IconName,
  type PrimitiveAccessibility,
  type PrimitiveStyleSlot,
  type StatusTone,
  type TouchTargetContract,
} from './types.js';

export interface IconPrimitiveInput {
  readonly name: IconName;
  readonly decorative?: boolean;
  readonly label?: string;
}

export interface IconPrimitive {
  readonly kind: 'icon';
  readonly name: IconName;
  readonly decorative: boolean;
  readonly accessibilityLabel: string | null;
}

export function createIconPrimitive(input: IconPrimitiveInput): IconPrimitive {
  const decorative = input.decorative ?? false;
  const label = input.label?.trim() || null;
  if (!decorative && label === null) {
    throw new Error('Meaningful icons require an accessibility label');
  }
  if (decorative && label !== null) {
    throw new Error('Decorative icons must not expose an accessibility label');
  }
  return {
    kind: 'icon',
    name: input.name,
    decorative,
    accessibilityLabel: decorative ? null : label,
  };
}

const STATUS_ICON: Readonly<Record<StatusTone, IconName>> = {
  success: 'check',
  warning: 'warning',
  danger: 'error',
  info: 'info',
  neutral: 'info',
};

const STATUS_STYLE_SLOTS: Readonly<Record<StatusTone, readonly PrimitiveStyleSlot[]>> = {
  success: ['status.success.surface', 'status.success.foreground'],
  warning: ['status.warning.surface', 'status.warning.foreground'],
  danger: ['status.danger.surface', 'status.danger.foreground'],
  info: ['status.info.surface', 'status.info.foreground'],
  neutral: ['status.neutral.surface', 'status.neutral.foreground'],
};

export interface StatusBadgePrimitiveInput {
  readonly label: string;
  readonly tone: StatusTone;
  readonly description?: string;
  readonly icon?: IconName;
}

export interface StatusBadgePrimitive {
  readonly kind: 'statusBadge';
  readonly label: string;
  readonly tone: StatusTone;
  readonly description: string | null;
  readonly icon: IconPrimitive;
  readonly accessibilityLabel: string;
  readonly styleSlots: readonly PrimitiveStyleSlot[];
}

export function createStatusBadgePrimitive(input: StatusBadgePrimitiveInput): StatusBadgePrimitive {
  const label = requireNonEmpty(input.label, 'status label');
  const description = input.description?.trim() || null;
  return {
    kind: 'statusBadge',
    label,
    tone: input.tone,
    description,
    icon: createIconPrimitive({
      name: input.icon ?? STATUS_ICON[input.tone],
      label: `${label} status`,
    }),
    accessibilityLabel: description === null ? label : `${label}. ${description}`,
    styleSlots: STATUS_STYLE_SLOTS[input.tone],
  };
}

export interface PricePrimitiveInput {
  readonly amountPaise: number;
  readonly originalAmountPaise?: number;
  readonly locale?: string;
  readonly currency?: 'INR';
}

export interface PricePrimitive {
  readonly kind: 'price';
  readonly amountPaise: number;
  readonly originalAmountPaise: number | null;
  readonly formatted: string;
  readonly originalFormatted: string | null;
  readonly discounted: boolean;
  readonly accessibilityLabel: string;
  readonly styleSlots: readonly PrimitiveStyleSlot[];
}

function requirePaise(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer number of paise`);
  }
  return value;
}

export function createPricePrimitive(input: PricePrimitiveInput): PricePrimitive {
  const amountPaise = requirePaise(input.amountPaise, 'amountPaise');
  const originalAmountPaise =
    input.originalAmountPaise === undefined
      ? null
      : requirePaise(input.originalAmountPaise, 'originalAmountPaise');
  if (originalAmountPaise !== null && originalAmountPaise < amountPaise) {
    throw new Error('originalAmountPaise cannot be lower than amountPaise');
  }
  const formatter = new Intl.NumberFormat(input.locale ?? 'en-IN', {
    style: 'currency',
    currency: input.currency ?? 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const formatted = formatter.format(amountPaise / 100);
  const originalFormatted =
    originalAmountPaise === null ? null : formatter.format(originalAmountPaise / 100);
  const discounted = originalAmountPaise !== null && originalAmountPaise > amountPaise;

  return {
    kind: 'price',
    amountPaise,
    originalAmountPaise,
    formatted,
    originalFormatted,
    discounted,
    accessibilityLabel:
      discounted && originalFormatted !== null
        ? `${formatted}, reduced from ${originalFormatted}`
        : formatted,
    styleSlots: discounted ? ['text.primary', 'status.success.foreground'] : ['text.primary'],
  };
}

export type CardVariant = 'default' | 'elevated' | 'inset' | 'selected';

export interface CardPrimitiveInput {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly variant?: CardVariant;
  readonly interactive?: boolean;
  readonly disabled?: boolean;
  readonly selected?: boolean;
  readonly accessibilityLabel?: string;
}

export interface CardPrimitive {
  readonly kind: 'card';
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly variant: CardVariant;
  readonly interactive: boolean;
  readonly disabled: boolean;
  readonly selected: boolean;
  readonly accessibility: PrimitiveAccessibility | null;
  readonly minimumTouchTarget: TouchTargetContract | null;
  readonly styleSlots: readonly PrimitiveStyleSlot[];
}

export function createCardPrimitive(input: CardPrimitiveInput): CardPrimitive {
  const id = requireIdentifier(input.id, 'card id');
  const title = requireNonEmpty(input.title, 'card title');
  const interactive = input.interactive ?? false;
  const selected = input.selected ?? false;
  if (selected && !interactive) {
    throw new Error('Only interactive cards can be selected');
  }
  const disabled = input.disabled ?? false;
  const variant = selected ? 'selected' : (input.variant ?? 'default');
  const accessibilityLabel = input.accessibilityLabel?.trim() || null;
  if (interactive && accessibilityLabel === null) {
    throw new Error('Interactive cards require an accessibility label');
  }
  const styleSlots: readonly PrimitiveStyleSlot[] =
    variant === 'selected'
      ? ['surface.elevated', 'text.primary', 'border.selected', 'border.focus']
      : variant === 'inset'
        ? ['surface.inset', 'text.primary', 'border.default']
        : ['surface.elevated', 'text.primary', 'border.default', 'border.focus'];

  return {
    kind: 'card',
    id,
    title,
    description: input.description?.trim() || null,
    variant,
    interactive,
    disabled,
    selected,
    accessibility:
      interactive && accessibilityLabel !== null
        ? {
            label: accessibilityLabel,
            hint: null,
            state: createAccessibilityState({ disabled, selected }),
          }
        : null,
    minimumTouchTarget: interactive ? MOBILE_TOUCH_TARGET : null,
    styleSlots,
  };
}

export type SkeletonShape = 'line' | 'rectangle' | 'circle';

export interface SkeletonPrimitiveInput {
  readonly id: string;
  readonly shape: SkeletonShape;
  readonly width: number;
  readonly height: number;
  readonly reducedMotion?: boolean;
}

export interface SkeletonPrimitive {
  readonly kind: 'skeleton';
  readonly id: string;
  readonly shape: SkeletonShape;
  readonly width: number;
  readonly height: number;
  readonly animated: boolean;
  readonly accessibilityHidden: true;
  readonly styleSlots: readonly PrimitiveStyleSlot[];
}

export function createSkeletonPrimitive(input: SkeletonPrimitiveInput): SkeletonPrimitive {
  const width = requirePositiveDimension(input.width, 'skeleton width');
  const height = requirePositiveDimension(input.height, 'skeleton height');
  if (input.shape === 'circle' && width !== height) {
    throw new Error('Circular skeletons require equal width and height');
  }
  return {
    kind: 'skeleton',
    id: requireIdentifier(input.id, 'skeleton id'),
    shape: input.shape,
    width,
    height,
    animated: !(input.reducedMotion ?? false),
    accessibilityHidden: true,
    styleSlots: ['surface.inset'],
  };
}

function requirePositiveDimension(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be greater than zero`);
  }
  return value;
}
