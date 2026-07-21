import {
  requireIdentifier,
  requireNonEmpty,
  type PrimitiveAction,
  type PrimitiveStyleSlot,
  type StatusTone,
} from './types.js';

export type ErrorStateKind = 'recoverable' | 'fatal' | 'offline' | 'permission' | 'sessionExpired';

export interface ErrorStatePrimitiveInput {
  readonly id: string;
  readonly kind: ErrorStateKind;
  readonly title: string;
  readonly message: string;
  readonly primaryAction?: PrimitiveAction;
  readonly secondaryAction?: PrimitiveAction;
}

export interface ErrorStatePrimitive {
  readonly kind: 'errorState';
  readonly id: string;
  readonly errorKind: ErrorStateKind;
  readonly title: string;
  readonly message: string;
  readonly primaryAction: PrimitiveAction | null;
  readonly secondaryAction: PrimitiveAction | null;
  readonly live: 'polite' | 'assertive';
  readonly styleSlots: readonly PrimitiveStyleSlot[];
}

function normalizeAction(
  action: PrimitiveAction | undefined,
  field: string,
): PrimitiveAction | null {
  if (action === undefined) {
    return null;
  }
  return {
    id: requireIdentifier(action.id, `${field} id`),
    label: requireNonEmpty(action.label, `${field} label`),
    accessibilityLabel: requireNonEmpty(action.accessibilityLabel, `${field} accessibility label`),
  };
}

export function createErrorStatePrimitive(input: ErrorStatePrimitiveInput): ErrorStatePrimitive {
  const primaryAction = normalizeAction(input.primaryAction, 'primary action');
  const secondaryAction = normalizeAction(input.secondaryAction, 'secondary action');
  if (input.kind === 'recoverable' && primaryAction === null) {
    throw new Error('Recoverable error states require a primary recovery action');
  }
  return {
    kind: 'errorState',
    id: requireIdentifier(input.id, 'error state id'),
    errorKind: input.kind,
    title: requireNonEmpty(input.title, 'error title'),
    message: requireNonEmpty(input.message, 'error message'),
    primaryAction,
    secondaryAction,
    live: input.kind === 'fatal' || input.kind === 'sessionExpired' ? 'assertive' : 'polite',
    styleSlots: ['surface.elevated', 'text.primary', 'status.danger.foreground'],
  };
}

export interface ToastPrimitiveInput {
  readonly id: string;
  readonly message: string;
  readonly tone?: StatusTone;
  readonly durationMs?: number | null;
  readonly action?: PrimitiveAction;
}

export interface ToastPrimitive {
  readonly kind: 'toast';
  readonly id: string;
  readonly message: string;
  readonly tone: StatusTone;
  readonly durationMs: number | null;
  readonly action: PrimitiveAction | null;
  readonly live: 'polite' | 'assertive';
  readonly styleSlots: readonly PrimitiveStyleSlot[];
}

const TOAST_STYLE_SLOTS: Readonly<Record<StatusTone, readonly PrimitiveStyleSlot[]>> = {
  success: ['surface.overlay', 'text.inverse', 'status.success.foreground'],
  warning: ['surface.overlay', 'text.inverse', 'status.warning.foreground'],
  danger: ['surface.overlay', 'text.inverse', 'status.danger.foreground'],
  info: ['surface.overlay', 'text.inverse', 'status.info.foreground'],
  neutral: ['surface.overlay', 'text.inverse', 'status.neutral.foreground'],
};

export function createToastPrimitive(input: ToastPrimitiveInput): ToastPrimitive {
  const tone = input.tone ?? 'neutral';
  const durationMs = normalizeToastDuration(input.durationMs);
  return {
    kind: 'toast',
    id: requireIdentifier(input.id, 'toast id'),
    message: requireNonEmpty(input.message, 'toast message'),
    tone,
    durationMs,
    action: normalizeAction(input.action, 'toast action'),
    live: tone === 'danger' ? 'assertive' : 'polite',
    styleSlots: TOAST_STYLE_SLOTS[tone],
  };
}

function normalizeToastDuration(durationMs: number | null | undefined): number | null {
  if (durationMs === null) {
    return null;
  }
  const requested = durationMs ?? 4_000;
  if (!Number.isFinite(requested)) {
    throw new Error('toast duration must be finite or null');
  }
  return Math.min(10_000, Math.max(2_000, Math.round(requested)));
}

export interface ToastStore {
  getSnapshot(): readonly ToastPrimitive[];
  push(input: ToastPrimitiveInput): ToastPrimitive;
  dismiss(id: string): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

export function createToastStore(maxVisible = 3): ToastStore {
  if (!Number.isSafeInteger(maxVisible) || maxVisible < 1 || maxVisible > 5) {
    throw new Error('maxVisible must be an integer between 1 and 5');
  }
  let snapshot: readonly ToastPrimitive[] = [];
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: () => snapshot,
    push: (input) => {
      const toast = createToastPrimitive(input);
      snapshot = [...snapshot.filter((item) => item.id !== toast.id), toast].slice(-maxVisible);
      emit();
      return toast;
    },
    dismiss: (id) => {
      const normalizedId = requireIdentifier(id, 'toast id');
      const next = snapshot.filter((toast) => toast.id !== normalizedId);
      if (next.length !== snapshot.length) {
        snapshot = next;
        emit();
      }
    },
    clear: () => {
      if (snapshot.length > 0) {
        snapshot = [];
        emit();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
