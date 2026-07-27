import type { CustomerOrderCancellationInput } from './customer-order-cancellation.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class CustomerOrderCancellationValidationError extends Error {
  public constructor() {
    super('Customer order cancellation input is invalid');
    this.name = 'CustomerOrderCancellationValidationError';
  }
}

export class CustomerOrderCancellationIdempotencyKeyRequiredError extends Error {
  public constructor() {
    super('Customer order cancellation idempotency key is required');
    this.name = 'CustomerOrderCancellationIdempotencyKeyRequiredError';
  }
}

function requireUuid(value: unknown, error: Error): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw error;
  return value.toLowerCase();
}

export function parseCustomerOrderCancellationInput(
  rawOrderId: unknown,
  rawIdempotencyKey: unknown,
): CustomerOrderCancellationInput {
  const orderId = requireUuid(rawOrderId, new CustomerOrderCancellationValidationError());
  const idempotencyKey = requireUuid(
    rawIdempotencyKey,
    new CustomerOrderCancellationIdempotencyKeyRequiredError(),
  );
  return { orderId, idempotencyKey };
}
