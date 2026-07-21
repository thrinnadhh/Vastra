import {
  createAccessibilityState,
  requireIdentifier,
  requireNonEmpty,
  type PrimitiveStyleSlot,
} from './types.js';

export type FieldInputMode =
  | 'text'
  | 'tel'
  | 'email'
  | 'numeric'
  | 'decimal'
  | 'search'
  | 'url';

export type FieldAutoComplete =
  | 'off'
  | 'name'
  | 'tel'
  | 'email'
  | 'street-address'
  | 'postal-code'
  | 'one-time-code';

export interface FieldPrimitiveInput {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly name?: string;
  readonly description?: string;
  readonly error?: string;
  readonly placeholder?: string;
  readonly inputMode?: FieldInputMode;
  readonly autoComplete?: FieldAutoComplete;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly multiline?: boolean;
  readonly secure?: boolean;
}

export interface FieldPrimitive {
  readonly kind: 'field';
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly labelId: string;
  readonly value: string;
  readonly description: string | null;
  readonly descriptionId: string | null;
  readonly error: string | null;
  readonly errorId: string | null;
  readonly describedBy: readonly string[];
  readonly placeholder: string | null;
  readonly inputMode: FieldInputMode;
  readonly autoComplete: FieldAutoComplete;
  readonly required: boolean;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly multiline: boolean;
  readonly secure: boolean;
  readonly accessibility: {
    readonly label: string;
    readonly hint: string | null;
    readonly state: ReturnType<typeof createAccessibilityState>;
  };
  readonly styleSlots: readonly PrimitiveStyleSlot[];
}

export function createFieldPrimitive(input: FieldPrimitiveInput): FieldPrimitive {
  const id = requireIdentifier(input.id, 'field id');
  const label = requireNonEmpty(input.label, 'field label');
  const description = input.description?.trim() || null;
  const error = input.error?.trim() || null;
  const descriptionId = description === null ? null : `${id}-description`;
  const errorId = error === null ? null : `${id}-error`;
  const describedBy = [descriptionId, errorId].filter((value): value is string => value !== null);
  const disabled = input.disabled ?? false;

  return {
    kind: 'field',
    id,
    name: requireIdentifier(input.name ?? id, 'field name'),
    label,
    labelId: `${id}-label`,
    value: input.value,
    description,
    descriptionId,
    error,
    errorId,
    describedBy,
    placeholder: input.placeholder?.trim() || null,
    inputMode: input.inputMode ?? 'text',
    autoComplete: input.autoComplete ?? 'off',
    required: input.required ?? false,
    disabled,
    readOnly: input.readOnly ?? false,
    multiline: input.multiline ?? false,
    secure: input.secure ?? false,
    accessibility: {
      label,
      hint: error ?? description,
      state: createAccessibilityState({ disabled, invalid: error !== null }),
    },
    styleSlots:
      error === null
        ? ['surface.inset', 'text.primary', 'border.default', 'border.focus']
        : ['surface.inset', 'text.primary', 'border.error', 'border.focus'],
  };
}
