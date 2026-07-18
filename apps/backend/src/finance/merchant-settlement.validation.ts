import type {
  CreateMerchantSettlementInput,
  MerchantSettlementPeriod,
} from './merchant-settlement.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const ALLOWED_KEYS = new Set(['shopId', 'periodStart', 'periodEnd', 'reasonCode', 'note']);

export class MerchantSettlementValidationError extends Error {}
export class MerchantSettlementIdempotencyKeyRequiredError extends Error {}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MerchantSettlementValidationError();
  }
  return value as Record<string, unknown>;
}

export function requireMerchantSettlementUuid(value: unknown): string {
  if (typeof value !== 'string') throw new MerchantSettlementValidationError();
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) throw new MerchantSettlementValidationError();
  return normalized;
}

function requireDate(value: unknown): string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new MerchantSettlementValidationError();
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new MerchantSettlementValidationError();
  }
  return value;
}

function parsePeriod(record: Record<string, unknown>): MerchantSettlementPeriod {
  const periodStart = requireDate(record['periodStart']);
  const periodEnd = requireDate(record['periodEnd']);
  if (periodEnd < periodStart) throw new MerchantSettlementValidationError();
  return {
    shopId: requireMerchantSettlementUuid(record['shopId']),
    periodStart,
    periodEnd,
  };
}

export function parseMerchantSettlementPeriod(
  shopId: unknown,
  periodStart: unknown,
  periodEnd: unknown,
): MerchantSettlementPeriod {
  return parsePeriod({ shopId, periodStart, periodEnd });
}

export function parseCreateMerchantSettlementInput(
  body: unknown,
  idempotencyKey: unknown,
): CreateMerchantSettlementInput {
  const record = requireRecord(body);
  if (Object.keys(record).some((key) => !ALLOWED_KEYS.has(key))) {
    throw new MerchantSettlementValidationError();
  }
  if (idempotencyKey === undefined || idempotencyKey === null || idempotencyKey === '') {
    throw new MerchantSettlementIdempotencyKeyRequiredError();
  }
  const reasonCode = record['reasonCode'];
  if (typeof reasonCode !== 'string' || reasonCode.trim().length < 2 || reasonCode.length > 120) {
    throw new MerchantSettlementValidationError();
  }
  const rawNote = record['note'];
  let note: string | null = null;
  if (rawNote !== undefined && rawNote !== null && rawNote !== '') {
    if (typeof rawNote !== 'string') throw new MerchantSettlementValidationError();
    note = rawNote.trim();
    if (note.length === 0 || note.length > 1000) {
      throw new MerchantSettlementValidationError();
    }
  }
  return {
    ...parsePeriod(record),
    reasonCode: reasonCode.trim(),
    note,
    idempotencyKey: requireMerchantSettlementUuid(idempotencyKey),
  };
}
