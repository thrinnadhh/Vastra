import type { ApiClient } from '@vastra/api-client';

import {
  CustomerCartError,
  type CustomerCart,
  type CustomerCartFailureKind,
  type CustomerCartPort,
  type SetCustomerCartItemInput,
} from './customer-cart.types';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function mapFailure(error: unknown): CustomerCartError {
  if (!isRecord(error) || !isRecord(error['normalized'])) {
    return new CustomerCartError('UNKNOWN', null, false);
  }

  const normalized = error['normalized'];
  const status = typeof normalized['status'] === 'number' ? normalized['status'] : null;
  const code = typeof normalized['code'] === 'string' ? normalized['code'] : null;
  const retryable = normalized['retryable'] === true;
  const apiKind = normalized['kind'];
  let kind: CustomerCartFailureKind = 'UNKNOWN';

  if (apiKind === 'TRANSPORT') kind = 'TRANSPORT';
  else if (apiKind === 'TIMEOUT') kind = 'TIMEOUT';
  else if (status === 401) kind = 'AUTHENTICATION';
  else if (status === 403) kind = 'FORBIDDEN';
  else if (code === 'CART_SHOP_CONFLICT') kind = 'SHOP_CONFLICT';
  else if (code === 'PRICE_CHANGED' || code === 'CHECKOUT_QUOTE_EXPIRED') kind = 'PRICE_CONFLICT';
  else if (code === 'INSUFFICIENT_INVENTORY' || code === 'INVENTORY_CONFLICT')
    kind = 'INVENTORY_CONFLICT';
  else if (code === 'VARIANT_NOT_FOUND' || code === 'CART_ITEM_NOT_FOUND')
    kind = 'UNAVAILABLE_ITEM';
  else if (status === 404) kind = 'NOT_FOUND';
  else if (status === 503 || code === 'EXTERNAL_SERVICE_UNAVAILABLE')
    kind = 'TEMPORARILY_UNAVAILABLE';

  return new CustomerCartError(kind, code, retryable);
}

function cartFrom(value: unknown): CustomerCart | null {
  if (!isRecord(value) || !isRecord(value['data']) || !isRecord(value['data']['data'])) {
    throw new CustomerCartError('MALFORMED_RESPONSE', null, false);
  }
  const cart = value['data']['data']['cart'];
  if (cart === null) return null;
  if (!isRecord(cart) || !Array.isArray(cart['items'])) {
    throw new CustomerCartError('MALFORMED_RESPONSE', null, false);
  }
  return cart as unknown as CustomerCart;
}

export class ApiCustomerCartAdapter implements CustomerCartPort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async getCart(): Promise<CustomerCart | null> {
    return this.request('getCustomerCart');
  }

  public async setItem(input: SetCustomerCartItemInput): Promise<CustomerCart | null> {
    return this.request('setCustomerCartItem', {
      body: {
        variantId: input.variantId,
        quantity: input.quantity,
        replaceExistingCart: input.replaceExistingCart ?? false,
      },
    });
  }

  public async updateItem(cartItemId: string, quantity: number): Promise<CustomerCart | null> {
    return this.request('updateCustomerCartItem', {
      path: { cartItemId },
      body: { quantity },
    });
  }

  public async removeItem(cartItemId: string): Promise<CustomerCart | null> {
    return this.request('removeCustomerCartItem', { path: { cartItemId } });
  }

  public async clearCart(): Promise<CustomerCart | null> {
    return this.request('clearCustomerCart');
  }

  private async request(operationId: Parameters<ApiClient['request']>[0], input?: unknown) {
    try {
      const value: unknown = await this.apiClient.request(operationId, input as never);
      return cartFrom(value);
    } catch (error: unknown) {
      if (error instanceof CustomerCartError) throw error;
      throw mapFailure(error);
    }
  }
}
