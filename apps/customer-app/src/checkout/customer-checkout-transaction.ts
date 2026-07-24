export type CustomerCheckoutPlacementPhase =
  'IDLE' | 'CONFIRMING' | 'SUBMITTING' | 'UNCERTAIN' | 'RECONCILING' | 'SUCCEEDED' | 'FAILED';

export interface CustomerCheckoutTransaction {
  readonly cartId: string | null;
  readonly addressId: string | null;
  readonly quoteId: string | null;
  readonly orderId: string | null;
  readonly idempotencyKey: string;
  readonly placementPhase: CustomerCheckoutPlacementPhase;
}

export interface CustomerCheckoutQuoteIdentity {
  readonly cartId: string;
  readonly addressId: string;
  readonly quoteId: string;
}

export function createCustomerCheckoutTransaction(
  idempotencyKey: string,
): CustomerCheckoutTransaction {
  return {
    cartId: null,
    addressId: null,
    quoteId: null,
    orderId: null,
    idempotencyKey,
    placementPhase: 'IDLE',
  };
}

export function selectCustomerCheckoutAddress(
  transaction: CustomerCheckoutTransaction,
  addressId: string | null,
): CustomerCheckoutTransaction {
  if (transaction.addressId === addressId) return transaction;
  return {
    ...transaction,
    addressId,
    cartId: null,
    quoteId: null,
    orderId: null,
    placementPhase: 'IDLE',
  };
}

export function acceptCustomerCheckoutQuote(
  transaction: CustomerCheckoutTransaction,
  identity: CustomerCheckoutQuoteIdentity,
): CustomerCheckoutTransaction | null {
  if (transaction.addressId === null || transaction.addressId !== identity.addressId) {
    return null;
  }
  return {
    ...transaction,
    cartId: identity.cartId,
    quoteId: identity.quoteId,
    orderId: null,
    placementPhase: 'IDLE',
  };
}

export function invalidateCustomerCheckoutQuote(
  transaction: CustomerCheckoutTransaction,
): CustomerCheckoutTransaction {
  return {
    ...transaction,
    cartId: null,
    quoteId: null,
    orderId: null,
    placementPhase: 'IDLE',
  };
}

export function setCustomerCheckoutPlacementPhase(
  transaction: CustomerCheckoutTransaction,
  placementPhase: CustomerCheckoutPlacementPhase,
): CustomerCheckoutTransaction {
  return { ...transaction, placementPhase };
}

export function confirmCustomerCheckoutOrder(
  transaction: CustomerCheckoutTransaction,
  orderId: string,
): CustomerCheckoutTransaction {
  return { ...transaction, orderId, placementPhase: 'SUCCEEDED' };
}
