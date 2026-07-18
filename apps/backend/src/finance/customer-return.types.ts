export const CUSTOMER_RETURN_REASON_CODES = [
  'WRONG_SIZE',
  'WRONG_COLOUR',
  'WRONG_PRODUCT',
  'DAMAGED',
  'QUALITY',
  'DIFFERENT_FROM_IMAGE',
  'MISSING_ITEM',
  'CHANGED_MIND',
  'OTHER',
] as const;

export type CustomerReturnReasonCode = (typeof CUSTOMER_RETURN_REASON_CODES)[number];

export interface CustomerReturnItemInput {
  readonly orderItemId: string;
  readonly quantity: number;
  readonly reasonCode: CustomerReturnReasonCode;
}

export interface CreateCustomerReturnInput {
  readonly items: readonly CustomerReturnItemInput[];
  readonly customerNote: string | null;
  readonly idempotencyKey: string;
}

export type CustomerReturnEligibility = Readonly<Record<string, unknown>>;
export type CustomerReturnDetail = Readonly<Record<string, unknown>>;

export interface CustomerReturnResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: { readonly requestId: string | null };
}
