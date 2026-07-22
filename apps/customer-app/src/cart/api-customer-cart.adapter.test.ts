import { ApiCustomerCartAdapter } from './api-customer-cart.adapter';
import { CustomerCartError } from './customer-cart.types';

const CART = {
  id: '30000000-0000-4000-8000-000000000001',
  shop: {
    id: '40000000-0000-4000-8000-000000000001',
    name: 'Shop',
    slug: 'shop',
    logoObjectKey: null,
    operationalStatus: 'OPEN',
    acceptsOnlineOrders: true,
  },
  items: [],
  itemCount: 0,
  subtotalPaise: 0,
  currentSubtotalPaise: 0,
  hasPriceChanges: false,
  hasUnavailableItems: false,
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
};

const response = (cart: unknown) => ({ data: { data: { cart } } });

describe('ApiCustomerCartAdapter', () => {
  it('uses generated cart operations and desired final quantities', async () => {
    const request = jest.fn().mockResolvedValue(response(CART));
    const adapter = new ApiCustomerCartAdapter({ request } as never);

    await adapter.getCart();
    await adapter.setItem({ variantId: 'v', quantity: 2, replaceExistingCart: true });
    await adapter.updateItem('line', 3);
    await adapter.removeItem('line');
    await adapter.clearCart();

    expect(request.mock.calls).toEqual([
      ['getCustomerCart', undefined],
      ['setCustomerCartItem', { body: { variantId: 'v', quantity: 2, replaceExistingCart: true } }],
      ['updateCustomerCartItem', { path: { cartItemId: 'line' }, body: { quantity: 3 } }],
      ['removeCustomerCartItem', { path: { cartItemId: 'line' } }],
      ['clearCustomerCart', undefined],
    ]);
  });

  it('maps one-shop conflicts without fabricating replacement', async () => {
    const request = jest.fn().mockRejectedValue({
      normalized: { status: 409, code: 'CART_SHOP_CONFLICT', retryable: false },
    });
    const adapter = new ApiCustomerCartAdapter({ request } as never);

    await expect(adapter.setItem({ variantId: 'v', quantity: 1 })).rejects.toMatchObject({
      kind: 'SHOP_CONFLICT',
      code: 'CART_SHOP_CONFLICT',
    });
  });

  it('rejects malformed success payloads', async () => {
    const adapter = new ApiCustomerCartAdapter({
      request: jest.fn().mockResolvedValue({}),
    } as never);
    await expect(adapter.getCart()).rejects.toBeInstanceOf(CustomerCartError);
  });
});
