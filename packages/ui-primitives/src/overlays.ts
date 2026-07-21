import {
  requireIdentifier,
  requireNonEmpty,
  trimToNull,
  type PrimitiveAction,
  type PrimitiveStyleSlot,
} from './types.js';

export interface SheetPrimitiveInput {
  readonly id: string;
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly dismissible?: boolean;
  readonly closeLabel?: string;
  readonly snapPoints?: readonly number[];
}

export interface SheetPrimitive {
  readonly kind: 'sheet';
  readonly id: string;
  readonly open: boolean;
  readonly title: string;
  readonly description: string | null;
  readonly dismissible: boolean;
  readonly closeLabel: string | null;
  readonly snapPoints: readonly number[];
  readonly modal: true;
  readonly restoreFocus: true;
  readonly trapFocusOnWeb: true;
  readonly styleSlots: readonly PrimitiveStyleSlot[];
}

export function createSheetPrimitive(input: SheetPrimitiveInput): SheetPrimitive {
  const dismissible = input.dismissible ?? true;
  const closeLabel = trimToNull(input.closeLabel);
  if (dismissible && closeLabel === null) {
    throw new Error('Dismissible sheets require a close label');
  }
  const snapPoints = normalizeSnapPoints(input.snapPoints ?? [1]);
  return {
    kind: 'sheet',
    id: requireIdentifier(input.id, 'sheet id'),
    open: input.open,
    title: requireNonEmpty(input.title, 'sheet title'),
    description: trimToNull(input.description),
    dismissible,
    closeLabel,
    snapPoints,
    modal: true,
    restoreFocus: true,
    trapFocusOnWeb: true,
    styleSlots: ['surface.overlay', 'surface.elevated', 'text.primary', 'border.strong'],
  };
}

function normalizeSnapPoints(points: readonly number[]): readonly number[] {
  if (points.length === 0) {
    throw new Error('Sheets require at least one snap point');
  }
  const normalized = [...new Set(points)].sort((left, right) => left - right);
  for (const point of normalized) {
    if (!Number.isFinite(point) || point <= 0 || point > 1) {
      throw new Error('Sheet snap points must be greater than zero and at most one');
    }
  }
  return normalized;
}

export type DialogTone = 'default' | 'destructive' | 'urgent';

export interface DialogPrimitiveInput {
  readonly id: string;
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmAction: PrimitiveAction;
  readonly cancelAction?: PrimitiveAction;
  readonly tone?: DialogTone;
  readonly dismissible?: boolean;
}

export interface DialogPrimitive {
  readonly kind: 'dialog';
  readonly id: string;
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmAction: PrimitiveAction;
  readonly cancelAction: PrimitiveAction | null;
  readonly tone: DialogTone;
  readonly dismissible: boolean;
  readonly role: 'dialog' | 'alertdialog';
  readonly modal: true;
  readonly restoreFocus: true;
  readonly trapFocusOnWeb: true;
  readonly styleSlots: readonly PrimitiveStyleSlot[];
}

function normalizeAction(action: PrimitiveAction, field: string): PrimitiveAction {
  return {
    id: requireIdentifier(action.id, `${field} id`),
    label: requireNonEmpty(action.label, `${field} label`),
    accessibilityLabel: requireNonEmpty(action.accessibilityLabel, `${field} accessibility label`),
  };
}

export function createDialogPrimitive(input: DialogPrimitiveInput): DialogPrimitive {
  const tone = input.tone ?? 'default';
  const dismissible = input.dismissible ?? tone === 'default';
  const cancelAction =
    input.cancelAction === undefined ? null : normalizeAction(input.cancelAction, 'cancel action');
  if (!dismissible && cancelAction === null) {
    throw new Error('Non-dismissible dialogs require an explicit cancel action');
  }
  return {
    kind: 'dialog',
    id: requireIdentifier(input.id, 'dialog id'),
    open: input.open,
    title: requireNonEmpty(input.title, 'dialog title'),
    description: requireNonEmpty(input.description, 'dialog description'),
    confirmAction: normalizeAction(input.confirmAction, 'confirm action'),
    cancelAction,
    tone,
    dismissible,
    role: tone === 'default' ? 'dialog' : 'alertdialog',
    modal: true,
    restoreFocus: true,
    trapFocusOnWeb: true,
    styleSlots:
      tone === 'destructive'
        ? ['surface.overlay', 'surface.elevated', 'text.primary', 'status.danger.foreground']
        : tone === 'urgent'
          ? ['surface.overlay', 'surface.elevated', 'text.primary', 'status.warning.foreground']
          : ['surface.overlay', 'surface.elevated', 'text.primary', 'border.strong'],
  };
}
