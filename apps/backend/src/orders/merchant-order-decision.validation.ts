import {
  MERCHANT_REJECTION_REASONS,
  type MerchantAcceptOrderInput,
  type MerchantRejectOrderInput,
  type MerchantRejectionReason,
} from './merchant-order-decision.types';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export class MerchantOrderDecisionValidationError extends Error {
  public constructor() {
    super('Merchant order decision input is invalid');
    this.name = 'MerchantOrderDecisionValidationError';
  }
}
function isMerchantRejectionReason(value: string): value is MerchantRejectionReason {
  return MERCHANT_REJECTION_REASONS.some((candidate) => candidate === value);
}

function record(v: unknown): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    throw new MerchantOrderDecisionValidationError();
  return v as Record<string, unknown>;
}
export function parseMerchantDecisionOrderId(v: unknown): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new MerchantOrderDecisionValidationError();
  return v;
}
export function parseMerchantAcceptOrderInput(v: unknown): MerchantAcceptOrderInput {
  const r = record(v);
  if (Object.keys(r).some((k) => k !== 'preparationMinutes'))
    throw new MerchantOrderDecisionValidationError();
  const n = r['preparationMinutes'];
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1 || n > 240)
    throw new MerchantOrderDecisionValidationError();
  return { preparationMinutes: n };
}
export function parseMerchantRejectOrderInput(v: unknown): MerchantRejectOrderInput {
  const r = record(v);
  if (Object.keys(r).some((k) => !['reasonCode', 'orderItemId', 'note'].includes(k)))
    throw new MerchantOrderDecisionValidationError();
  const reason = r['reasonCode'];
  if (typeof reason !== 'string' || !isMerchantRejectionReason(reason))
    throw new MerchantOrderDecisionValidationError();
  const item = r['orderItemId'];
  if (item !== undefined && item !== null && (typeof item !== 'string' || !UUID.test(item)))
    throw new MerchantOrderDecisionValidationError();
  const raw = r['note'];
  if (
    raw !== undefined &&
    raw !== null &&
    (typeof raw !== 'string' || raw.trim().length < 1 || raw.trim().length > 500)
  )
    throw new MerchantOrderDecisionValidationError();
  if (reason === 'OTHER' && (typeof raw !== 'string' || raw.trim().length < 1))
    throw new MerchantOrderDecisionValidationError();
  return {
    reasonCode: reason,
    orderItemId: typeof item === 'string' ? item : null,
    note: typeof raw === 'string' ? raw.trim() : null,
  };
}
