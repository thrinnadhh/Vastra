import {
  acceptCustomerCheckoutQuote,
  confirmCustomerCheckoutOrder,
  createCustomerCheckoutTransaction,
  invalidateCustomerCheckoutQuote,
  selectCustomerCheckoutAddress,
  setCustomerCheckoutPlacementPhase,
} from './customer-checkout-transaction';

const KEY = '00000000-0000-4000-8000-000000000001';
const ADDRESS_A = '00000000-0000-4000-8000-000000000002';
const ADDRESS_B = '00000000-0000-4000-8000-000000000003';
const CART = '00000000-0000-4000-8000-000000000004';
const QUOTE = '00000000-0000-4000-8000-000000000005';
const ORDER = '00000000-0000-4000-8000-000000000006';

describe('customer checkout transaction', () => {
  it('starts with only a stable idempotency key and workflow metadata', () => {
    expect(createCustomerCheckoutTransaction(KEY)).toEqual({
      cartId: null,
      addressId: null,
      quoteId: null,
      orderId: null,
      idempotencyKey: KEY,
      placementPhase: 'IDLE',
    });
  });

  it('invalidates server quote identifiers when the selected address changes', () => {
    const selected = selectCustomerCheckoutAddress(createCustomerCheckoutTransaction(KEY), ADDRESS_A);
    const quoted = acceptCustomerCheckoutQuote(selected, {
      addressId: ADDRESS_A,
      cartId: CART,
      quoteId: QUOTE,
    });

    expect(quoted).not.toBeNull();
    expect(selectCustomerCheckoutAddress(quoted!, ADDRESS_B)).toEqual({
      cartId: null,
      addressId: ADDRESS_B,
      quoteId: null,
      orderId: null,
      idempotencyKey: KEY,
      placementPhase: 'IDLE',
    });
  });

  it('rejects a quote produced for a different address', () => {
    const selected = selectCustomerCheckoutAddress(createCustomerCheckoutTransaction(KEY), ADDRESS_A);

    expect(
      acceptCustomerCheckoutQuote(selected, {
        addressId: ADDRESS_B,
        cartId: CART,
        quoteId: QUOTE,
      }),
    ).toBeNull();
  });

  it('preserves the transaction key across uncertainty and reconciliation', () => {
    const selected = selectCustomerCheckoutAddress(createCustomerCheckoutTransaction(KEY), ADDRESS_A);
    const quoted = acceptCustomerCheckoutQuote(selected, {
      addressId: ADDRESS_A,
      cartId: CART,
      quoteId: QUOTE,
    })!;
    const uncertain = setCustomerCheckoutPlacementPhase(quoted, 'UNCERTAIN');
    const reconciling = setCustomerCheckoutPlacementPhase(uncertain, 'RECONCILING');

    expect(reconciling.idempotencyKey).toBe(KEY);
    expect(reconciling.cartId).toBe(CART);
    expect(reconciling.quoteId).toBe(QUOTE);
  });

  it('clears quote identity without replacing the transaction key', () => {
    const selected = selectCustomerCheckoutAddress(createCustomerCheckoutTransaction(KEY), ADDRESS_A);
    const quoted = acceptCustomerCheckoutQuote(selected, {
      addressId: ADDRESS_A,
      cartId: CART,
      quoteId: QUOTE,
    })!;

    expect(invalidateCustomerCheckoutQuote(quoted)).toMatchObject({
      addressId: ADDRESS_A,
      cartId: null,
      quoteId: null,
      orderId: null,
      idempotencyKey: KEY,
    });
  });

  it('stores only the server-confirmed order identifier on success', () => {
    const confirmed = confirmCustomerCheckoutOrder(createCustomerCheckoutTransaction(KEY), ORDER);

    expect(confirmed.orderId).toBe(ORDER);
    expect(confirmed.placementPhase).toBe('SUCCEEDED');
    expect(Object.keys(confirmed).sort()).toEqual(
      ['addressId', 'cartId', 'idempotencyKey', 'orderId', 'placementPhase', 'quoteId'].sort(),
    );
  });
});
