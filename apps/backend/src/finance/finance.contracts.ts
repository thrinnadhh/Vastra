export const FINANCE_PROVIDER = 'cashfree' as const;
export const CASHFREE_API_VERSION = '2025-01-01' as const;
export const FINANCE_CURRENCY = 'INR' as const;

export const PAYMENT_ATTEMPT_STATUSES = [
  'CREATED',
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;

export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

export const PAYMENT_STATUS_TRANSITIONS: Readonly<
  Record<PaymentAttemptStatus, readonly PaymentAttemptStatus[]>
> = {
  CREATED: ['PENDING', 'FAILED', 'CANCELLED'],
  PENDING: ['AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['CAPTURED', 'FAILED', 'CANCELLED'],
  CAPTURED: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  FAILED: [],
  CANCELLED: [],
  PARTIALLY_REFUNDED: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  REFUNDED: [],
};

export const RETURN_REQUEST_STATUSES = [
  'REQUESTED',
  'REVIEW',
  'APPROVED',
  'REJECTED',
  'PICKUP_ASSIGNED',
  'PICKED_UP',
  'RECEIVED',
  'VERIFIED',
  'REFUND_PENDING',
  'REFUNDED',
  'CLOSED',
] as const;

export type ReturnRequestStatus = (typeof RETURN_REQUEST_STATUSES)[number];

export const RETURN_STATUS_TRANSITIONS: Readonly<
  Record<ReturnRequestStatus, readonly ReturnRequestStatus[]>
> = {
  REQUESTED: ['REVIEW'],
  REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PICKUP_ASSIGNED'],
  REJECTED: ['CLOSED'],
  PICKUP_ASSIGNED: ['PICKED_UP'],
  PICKED_UP: ['RECEIVED'],
  RECEIVED: ['VERIFIED', 'REVIEW'],
  VERIFIED: ['REFUND_PENDING', 'CLOSED'],
  REFUND_PENDING: ['REFUNDED'],
  REFUNDED: ['CLOSED'],
  CLOSED: [],
};

export const REFUND_STATUSES = [
  'PENDING',
  'APPROVAL_REQUIRED',
  'INITIATED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_STATUS_TRANSITIONS: Readonly<Record<RefundStatus, readonly RefundStatus[]>> = {
  PENDING: ['APPROVAL_REQUIRED', 'INITIATED', 'CANCELLED'],
  APPROVAL_REQUIRED: ['INITIATED', 'CANCELLED'],
  INITIATED: ['PROCESSING', 'COMPLETED', 'FAILED'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['INITIATED', 'CANCELLED'],
  CANCELLED: [],
};

export const MERCHANT_SETTLEMENT_STATUSES = [
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'FAILED',
  'ON_HOLD',
] as const;

export type MerchantSettlementStatus = (typeof MERCHANT_SETTLEMENT_STATUSES)[number];

export const CAPTAIN_EARNING_STATUSES = [
  'PENDING',
  'AVAILABLE',
  'INCLUDED_IN_PAYOUT',
  'PAID',
  'REVERSED',
] as const;

export type CaptainEarningStatus = (typeof CAPTAIN_EARNING_STATUSES)[number];

export const CAPTAIN_PAYOUT_STATUSES = [
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'PROCESSING',
  'PAID',
  'FAILED',
  'ON_HOLD',
] as const;

export type CaptainPayoutStatus = (typeof CAPTAIN_PAYOUT_STATUSES)[number];

export const FINANCE_LOCK_ORDER = [
  'ORDER',
  'PAYMENT',
  'PAYMENT_EVENT',
  'RETURN_REQUEST',
  'RETURN_ITEM',
  'REFUND',
  'MERCHANT_SETTLEMENT',
  'CAPTAIN_EARNING',
  'CAPTAIN_PAYOUT',
] as const;

export const FINANCE_AUDIT_RESOURCE_TYPES = [
  'PAYMENT',
  'PAYMENT_EVENT',
  'RETURN_REQUEST',
  'REFUND',
  'MERCHANT_SETTLEMENT',
  'CAPTAIN_EARNING',
  'CAPTAIN_PAYOUT',
  'COD_RECONCILIATION',
] as const;

export type FinanceAuditResourceType = (typeof FINANCE_AUDIT_RESOURCE_TYPES)[number];

export const FINANCE_MUTATION_REASON_CODES = [
  'PAYMENT_RECOVERY',
  'CUSTOMER_RETURN',
  'RETURN_LOGISTICS',
  'RETURN_INSPECTION',
  'REFUND_DECISION',
  'REFUND_EXECUTION',
  'SETTLEMENT_CYCLE',
  'PAYOUT_CYCLE',
  'COD_RECONCILIATION',
  'FINANCIAL_CORRECTION',
  'FRAUD_REVIEW',
  'OTHER',
] as const;

export type FinanceMutationReasonCode = (typeof FINANCE_MUTATION_REASON_CODES)[number];

export const FINANCE_ERROR_CODES = [
  'FINANCE_REQUEST_INVALID',
  'FINANCE_IDEMPOTENCY_KEY_REQUIRED',
  'FINANCE_IDEMPOTENCY_CONFLICT',
  'FINANCE_ORDER_NOT_PAYABLE',
  'FINANCE_PAYMENT_NOT_FOUND',
  'FINANCE_PAYMENT_STATE_CONFLICT',
  'FINANCE_PAYMENT_AMOUNT_MISMATCH',
  'FINANCE_PROVIDER_UNAVAILABLE',
  'FINANCE_PROVIDER_RESPONSE_INVALID',
  'FINANCE_WEBHOOK_SIGNATURE_INVALID',
  'FINANCE_WEBHOOK_REPLAYED',
  'FINANCE_WEBHOOK_EVENT_UNSUPPORTED',
  'FINANCE_RETURN_NOT_ELIGIBLE',
  'FINANCE_RETURN_QUANTITY_CONFLICT',
  'FINANCE_RETURN_STATE_CONFLICT',
  'FINANCE_REFUND_AMOUNT_CONFLICT',
  'FINANCE_REFUND_STATE_CONFLICT',
  'FINANCE_SETTLEMENT_NOT_ELIGIBLE',
  'FINANCE_PAYOUT_NOT_ELIGIBLE',
  'FINANCE_COD_NOT_RECONCILED',
] as const;

export type FinanceErrorCode = (typeof FINANCE_ERROR_CODES)[number];

const PROVIDER_AMOUNT_PATTERN = /^(0|[1-9]\d*)\.(\d{2})$/u;

export function formatPaiseForProvider(amountPaise: number): string {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
    throw new RangeError('amountPaise must be a positive safe integer');
  }
  const rupees = Math.floor(amountPaise / 100);
  const paise = amountPaise % 100;
  return `${String(rupees)}.${String(paise).padStart(2, '0')}`;
}

export function parseProviderAmountToPaise(amount: string): number {
  const match = PROVIDER_AMOUNT_PATTERN.exec(amount);
  if (match === null) throw new RangeError('provider amount must contain exactly two decimals');
  const rupees = Number(match[1]);
  const paise = Number(match[2]);
  const result = rupees * 100 + paise;
  if (!Number.isSafeInteger(result) || result < 1) {
    throw new RangeError('provider amount is outside the supported range');
  }
  return result;
}

export function canTransitionPayment(
  current: PaymentAttemptStatus,
  next: PaymentAttemptStatus,
): boolean {
  return PAYMENT_STATUS_TRANSITIONS[current].includes(next);
}

export function canTransitionReturn(
  current: ReturnRequestStatus,
  next: ReturnRequestStatus,
): boolean {
  return RETURN_STATUS_TRANSITIONS[current].includes(next);
}

export function canTransitionRefund(current: RefundStatus, next: RefundStatus): boolean {
  return REFUND_STATUS_TRANSITIONS[current].includes(next);
}
