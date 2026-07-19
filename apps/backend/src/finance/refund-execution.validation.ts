import type { RefundExecutionCommandInput } from './refund-execution.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const REASON_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/u;

export class RefundExecutionValidationError extends Error {}

export function requireRefundExecutionUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new RefundExecutionValidationError();
  }
  return value.trim().toLowerCase();
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RefundExecutionValidationError();
  }
  return value as Record<string, unknown>;
}

export function parseRefundExecutionCommand(
  body: unknown,
  rawIdempotencyKey: unknown,
): RefundExecutionCommandInput {
  const record = requireRecord(body);
  const rawReasonCode = record['reasonCode'];
  if (typeof rawReasonCode !== 'string') throw new RefundExecutionValidationError();
  const reasonCode = rawReasonCode.trim().toUpperCase();
  if (!REASON_PATTERN.test(reasonCode)) throw new RefundExecutionValidationError();

  const rawNote = record['note'];
  let note: string | null = null;
  if (rawNote !== undefined && rawNote !== null && rawNote !== '') {
    if (typeof rawNote !== 'string') throw new RefundExecutionValidationError();
    note = rawNote.trim();
    if (note.length === 0 || note.length > 1000) {
      throw new RefundExecutionValidationError();
    }
  }

  return {
    idempotencyKey: requireRefundExecutionUuid(rawIdempotencyKey),
    reasonCode,
    note,
  };
}
