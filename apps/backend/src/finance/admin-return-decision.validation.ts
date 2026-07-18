import {
  ADMIN_RETURN_DECISIONS,
  type AdminReturnDecisionInput,
  type AdminReturnDecisionItem,
} from './admin-return-decision.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const REASON_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/u;

export class AdminReturnDecisionValidationError extends Error {}

export function requireAdminReturnUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new AdminReturnDecisionValidationError();
  }
  return value.trim().toLowerCase();
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdminReturnDecisionValidationError();
  }
  return value as Record<string, unknown>;
}

function optionalNote(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AdminReturnDecisionValidationError();
  const note = value.trim();
  if (note.length === 0 || note.length > 1000) {
    throw new AdminReturnDecisionValidationError();
  }
  return note;
}

function requireReasonCode(value: unknown): string {
  if (typeof value !== 'string') throw new AdminReturnDecisionValidationError();
  const reasonCode = value.trim().toUpperCase();
  if (!REASON_PATTERN.test(reasonCode)) throw new AdminReturnDecisionValidationError();
  return reasonCode;
}

export function parseAdminReturnDecision(
  body: unknown,
  rawIdempotencyKey: unknown,
): AdminReturnDecisionInput {
  const record = requireRecord(body);
  const rawDecision = record['decision'];
  if (
    typeof rawDecision !== 'string' ||
    !ADMIN_RETURN_DECISIONS.includes(rawDecision as AdminReturnDecisionInput['decision'])
  ) {
    throw new AdminReturnDecisionValidationError();
  }

  const rawItems = record['items'];
  const items: AdminReturnDecisionItem[] = [];
  if (rawItems !== undefined) {
    if (!Array.isArray(rawItems) || rawItems.length > 100) {
      throw new AdminReturnDecisionValidationError();
    }
    const seen = new Set<string>();
    for (const rawItem of rawItems) {
      const item = requireRecord(rawItem);
      const returnItemId = requireAdminReturnUuid(item['returnItemId']);
      if (seen.has(returnItemId)) throw new AdminReturnDecisionValidationError();
      seen.add(returnItemId);
      const approvedQuantity = item['approvedQuantity'];
      if (
        typeof approvedQuantity !== 'number' ||
        !Number.isSafeInteger(approvedQuantity) ||
        approvedQuantity < 0
      ) {
        throw new AdminReturnDecisionValidationError();
      }
      items.push({
        returnItemId,
        approvedQuantity,
        reasonCode:
          item['reasonCode'] === undefined || item['reasonCode'] === null
            ? null
            : requireReasonCode(item['reasonCode']),
      });
    }
  }

  if (rawDecision === 'VERIFY' && items.length === 0) {
    throw new AdminReturnDecisionValidationError();
  }
  if (rawDecision !== 'VERIFY' && items.length !== 0) {
    throw new AdminReturnDecisionValidationError();
  }

  return {
    idempotencyKey: requireAdminReturnUuid(rawIdempotencyKey),
    decision: rawDecision as AdminReturnDecisionInput['decision'],
    reasonCode: requireReasonCode(record['reasonCode']),
    note: optionalNote(record['note']),
    items,
  };
}
