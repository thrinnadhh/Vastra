import {
  MERCHANT_INSPECTION_STATUSES,
  MERCHANT_RETURN_DECISIONS,
  type MerchantReturnCommandInput,
  type MerchantReturnInspectionInput,
  type MerchantReturnInspectionItem,
} from './merchant-return.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class MerchantReturnValidationError extends Error {}

export function requireMerchantReturnUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    throw new MerchantReturnValidationError();
  }
  return value.trim().toLowerCase();
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MerchantReturnValidationError();
  }
  return value as Record<string, unknown>;
}

function optionalNote(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new MerchantReturnValidationError();
  const note = value.trim();
  if (note.length === 0 || note.length > 1000) throw new MerchantReturnValidationError();
  return note;
}

export function parseMerchantReturnCommand(
  body: unknown,
  rawIdempotencyKey: unknown,
): MerchantReturnCommandInput {
  return {
    idempotencyKey: requireMerchantReturnUuid(rawIdempotencyKey),
    note: optionalNote(requireRecord(body)['note']),
  };
}

export function parseMerchantReturnInspection(
  body: unknown,
  rawIdempotencyKey: unknown,
): MerchantReturnInspectionInput {
  const record = requireRecord(body);
  const rawItems = record['items'];
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 100) {
    throw new MerchantReturnValidationError();
  }
  const seen = new Set<string>();
  const items: MerchantReturnInspectionItem[] = rawItems.map((rawItem) => {
    const item = requireRecord(rawItem);
    const returnItemId = requireMerchantReturnUuid(item['returnItemId']);
    if (seen.has(returnItemId)) throw new MerchantReturnValidationError();
    seen.add(returnItemId);
    const inspectionStatus = item['inspectionStatus'];
    const merchantDecision = item['merchantDecision'];
    if (
      typeof inspectionStatus !== 'string' ||
      !MERCHANT_INSPECTION_STATUSES.includes(
        inspectionStatus as MerchantReturnInspectionItem['inspectionStatus'],
      ) ||
      typeof merchantDecision !== 'string' ||
      !MERCHANT_RETURN_DECISIONS.includes(
        merchantDecision as MerchantReturnInspectionItem['merchantDecision'],
      )
    ) {
      throw new MerchantReturnValidationError();
    }
    if (merchantDecision === 'DISPUTED' && !['DISPUTED', 'WRONG_ITEM'].includes(inspectionStatus)) {
      throw new MerchantReturnValidationError();
    }
    const evidenceValue = item['evidenceObjectKey'];
    const evidenceObjectKey =
      evidenceValue === undefined || evidenceValue === null || evidenceValue === ''
        ? null
        : String(evidenceValue).trim();
    if (
      evidenceObjectKey !== null &&
      (evidenceObjectKey.length > 500 ||
        evidenceObjectKey.includes('..') ||
        evidenceObjectKey.endsWith('/'))
    ) {
      throw new MerchantReturnValidationError();
    }
    return {
      returnItemId,
      inspectionStatus: inspectionStatus as MerchantReturnInspectionItem['inspectionStatus'],
      merchantDecision: merchantDecision as MerchantReturnInspectionItem['merchantDecision'],
      note: optionalNote(item['note']),
      evidenceObjectKey,
    };
  });
  return { idempotencyKey: requireMerchantReturnUuid(rawIdempotencyKey), items };
}
