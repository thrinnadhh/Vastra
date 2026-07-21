import type { ButtonPrimitive } from './button.js';
import type {
  CardPrimitive,
  IconPrimitive,
  SkeletonPrimitive,
  StatusBadgePrimitive,
} from './display.js';
import type { ErrorStatePrimitive, ToastPrimitive } from './feedback.js';
import type { FieldPrimitive } from './field.js';
import type { DialogPrimitive, SheetPrimitive } from './overlays.js';

export interface WebButtonAdapterProps {
  readonly id: string;
  readonly type: 'button';
  readonly disabled: boolean;
  readonly tabIndex: 0 | -1;
  readonly 'aria-label': string;
  readonly 'aria-busy': boolean;
  readonly 'aria-disabled': boolean;
  readonly 'aria-expanded': boolean | undefined;
  readonly 'data-variant': ButtonPrimitive['variant'];
  readonly 'data-size': ButtonPrimitive['size'];
}

export function toWebButtonProps(button: ButtonPrimitive): WebButtonAdapterProps {
  return {
    id: button.id,
    type: 'button',
    disabled: button.disabled,
    tabIndex: button.disabled ? -1 : 0,
    'aria-label': button.accessibility.label,
    'aria-busy': button.busy,
    'aria-disabled': button.disabled,
    'aria-expanded': button.accessibility.state.expanded ?? undefined,
    'data-variant': button.variant,
    'data-size': button.size,
  };
}

export interface NativeButtonAdapterProps {
  readonly testID: string;
  readonly accessibilityRole: 'button';
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string | undefined;
  readonly accessibilityState: {
    readonly disabled: boolean;
    readonly busy: boolean;
    readonly expanded: boolean | undefined;
  };
  readonly disabled: boolean;
  readonly minimumTouchSize: {
    readonly android: number;
    readonly ios: number;
  };
}

export function toNativeButtonProps(button: ButtonPrimitive): NativeButtonAdapterProps {
  return {
    testID: button.id,
    accessibilityRole: 'button',
    accessibilityLabel: button.accessibility.label,
    accessibilityHint: button.accessibility.hint ?? undefined,
    accessibilityState: {
      disabled: button.disabled,
      busy: button.busy,
      expanded: button.accessibility.state.expanded ?? undefined,
    },
    disabled: button.disabled,
    minimumTouchSize: {
      android: button.minimumTouchTarget.android,
      ios: button.minimumTouchTarget.ios,
    },
  };
}

export interface WebFieldAdapterProps {
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly placeholder: string | undefined;
  readonly inputMode: FieldPrimitive['inputMode'];
  readonly autoComplete: FieldPrimitive['autoComplete'];
  readonly required: boolean;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly 'aria-labelledby': string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': boolean;
  readonly 'aria-errormessage': string | undefined;
}

export function toWebFieldProps(field: FieldPrimitive): WebFieldAdapterProps {
  return {
    id: field.id,
    name: field.name,
    value: field.value,
    placeholder: field.placeholder ?? undefined,
    inputMode: field.inputMode,
    autoComplete: field.autoComplete,
    required: field.required,
    disabled: field.disabled,
    readOnly: field.readOnly,
    'aria-labelledby': field.labelId,
    'aria-describedby': field.describedBy.length > 0 ? field.describedBy.join(' ') : undefined,
    'aria-invalid': field.error !== null,
    'aria-errormessage': field.errorId ?? undefined,
  };
}

export interface NativeFieldAdapterProps {
  readonly testID: string;
  readonly value: string;
  readonly placeholder: string | undefined;
  readonly editable: boolean;
  readonly secureTextEntry: boolean;
  readonly multiline: boolean;
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string | undefined;
  readonly accessibilityState: {
    readonly disabled: boolean;
  };
  readonly accessibilityInvalid: boolean;
}

export function toNativeFieldProps(field: FieldPrimitive): NativeFieldAdapterProps {
  return {
    testID: field.id,
    value: field.value,
    placeholder: field.placeholder ?? undefined,
    editable: !field.disabled && !field.readOnly,
    secureTextEntry: field.secure,
    multiline: field.multiline,
    accessibilityLabel: field.accessibility.label,
    accessibilityHint: field.accessibility.hint ?? undefined,
    accessibilityState: { disabled: field.disabled },
    accessibilityInvalid: field.error !== null,
  };
}

export function toWebStatusProps(status: StatusBadgePrimitive): Readonly<{
  role: 'status';
  'aria-label': string;
  'data-tone': StatusBadgePrimitive['tone'];
}> {
  return {
    role: 'status',
    'aria-label': status.accessibilityLabel,
    'data-tone': status.tone,
  };
}

export function toNativeStatusProps(status: StatusBadgePrimitive): Readonly<{
  accessibilityRole: 'text';
  accessibilityLabel: string;
}> {
  return {
    accessibilityRole: 'text',
    accessibilityLabel: status.accessibilityLabel,
  };
}

export function toWebIconProps(icon: IconPrimitive): Readonly<{
  'aria-hidden': boolean;
  'aria-label': string | undefined;
  role: 'img' | 'presentation';
}> {
  return {
    'aria-hidden': icon.decorative,
    'aria-label': icon.accessibilityLabel ?? undefined,
    role: icon.decorative ? 'presentation' : 'img',
  };
}

export function toNativeIconProps(icon: IconPrimitive): Readonly<{
  accessible: boolean;
  accessibilityLabel: string | undefined;
}> {
  return {
    accessible: !icon.decorative,
    accessibilityLabel: icon.accessibilityLabel ?? undefined,
  };
}

export function toWebCardProps(card: CardPrimitive): Readonly<{
  id: string;
  role: 'button' | 'article';
  tabIndex: 0 | -1 | undefined;
  'aria-label': string | undefined;
  'aria-disabled': boolean | undefined;
  'aria-selected': boolean | undefined;
}> {
  return {
    id: card.id,
    role: card.interactive ? 'button' : 'article',
    tabIndex: card.interactive ? (card.disabled ? -1 : 0) : undefined,
    'aria-label': card.accessibility?.label,
    'aria-disabled': card.interactive ? card.disabled : undefined,
    'aria-selected': card.interactive ? card.selected : undefined,
  };
}

export function toWebSkeletonProps(skeleton: SkeletonPrimitive): Readonly<{
  id: string;
  'aria-hidden': true;
  'data-animated': boolean;
}> {
  return {
    id: skeleton.id,
    'aria-hidden': true,
    'data-animated': skeleton.animated,
  };
}

export function toWebErrorProps(error: ErrorStatePrimitive): Readonly<{
  id: string;
  role: 'alert' | 'status';
  'aria-live': ErrorStatePrimitive['live'];
}> {
  return {
    id: error.id,
    role: error.live === 'assertive' ? 'alert' : 'status',
    'aria-live': error.live,
  };
}

export function toNativeErrorProps(error: ErrorStatePrimitive): Readonly<{
  testID: string;
  accessibilityRole: 'alert';
  accessibilityLiveRegion: 'polite' | 'assertive';
  accessibilityLabel: string;
}> {
  return {
    testID: error.id,
    accessibilityRole: 'alert',
    accessibilityLiveRegion: error.live,
    accessibilityLabel: `${error.title}. ${error.message}`,
  };
}

export function toWebSheetProps(sheet: SheetPrimitive): Readonly<{
  id: string;
  role: 'dialog';
  'aria-modal': true;
  'aria-label': string;
  hidden: boolean;
}> {
  return {
    id: sheet.id,
    role: 'dialog',
    'aria-modal': true,
    'aria-label': sheet.title,
    hidden: !sheet.open,
  };
}

export function toWebDialogProps(dialog: DialogPrimitive): Readonly<{
  id: string;
  role: DialogPrimitive['role'];
  'aria-modal': true;
  'aria-label': string;
  hidden: boolean;
}> {
  return {
    id: dialog.id,
    role: dialog.role,
    'aria-modal': true,
    'aria-label': dialog.title,
    hidden: !dialog.open,
  };
}

export function toWebToastProps(toast: ToastPrimitive): Readonly<{
  id: string;
  role: 'alert' | 'status';
  'aria-live': ToastPrimitive['live'];
  'data-tone': ToastPrimitive['tone'];
}> {
  return {
    id: toast.id,
    role: toast.live === 'assertive' ? 'alert' : 'status',
    'aria-live': toast.live,
    'data-tone': toast.tone,
  };
}
