import type { CreateCaptainPayoutInput, ReconcileCodInput } from './captain-finance.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export class CaptainFinanceValidationError extends Error {}

export function requireCaptainFinanceUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new CaptainFinanceValidationError();
  }
  return value.trim().toLowerCase();
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CaptainFinanceValidationError();
  }
  return value as Record<string, unknown>;
}

function optionalNote(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new CaptainFinanceValidationError();
  const note = value.trim();
  if (note.length === 0 || note.length > 1000) throw new CaptainFinanceValidationError();
  return note;
}

function requireDate(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !DATE_PATTERN.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  ) {
    throw new CaptainFinanceValidationError();
  }
  return value;
}

export function parseReconcileCodInput(
  body: unknown,
  rawIdempotencyKey: unknown,
): ReconcileCodInput {
  const record = requireRecord(body);
  const amount = record['depositedAmountPaise'];
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1) {
    throw new CaptainFinanceValidationError();
  }
  if (record['reasonCode'] !== 'COD_RECONCILIATION') throw new CaptainFinanceValidationError();
  return {
    depositedAmountPaise: amount,
    reasonCode: 'COD_RECONCILIATION',
    note: optionalNote(record['note']),
    idempotencyKey: requireCaptainFinanceUuid(rawIdempotencyKey),
  };
}

export function parseCreateCaptainPayoutInput(
  body: unknown,
  rawIdempotencyKey: unknown,
): CreateCaptainPayoutInput {
  const record = requireRecord(body);
  if (record['reasonCode'] !== 'PAYOUT_CYCLE') throw new CaptainFinanceValidationError();
  const periodStart = requireDate(record['periodStart']);
  const periodEnd = requireDate(record['periodEnd']);
  if (periodEnd < periodStart) throw new CaptainFinanceValidationError();
  return {
    captainId: requireCaptainFinanceUuid(record['captainId']),
    periodStart,
    periodEnd,
    reasonCode: 'PAYOUT_CYCLE',
    note: optionalNote(record['note']),
    idempotencyKey: requireCaptainFinanceUuid(rawIdempotencyKey),
  };
}
