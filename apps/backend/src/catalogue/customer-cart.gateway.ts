import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CustomerCartItemSnapshot,
  CustomerCartSnapshot,
  SetCustomerCartItemInput,
  UpdateCustomerCartItemInput,
} from './customer-cart.types';
import {
  SHOP_OPERATIONAL_STATUSES,
  type ShopOperationalStatus,
} from './merchant-shop-context.types';

export interface CustomerCartGateway {
  getCart(client: SupabaseClient): Promise<CustomerCartSnapshot | null>;
  setItem(actorId: string, input: SetCustomerCartItemInput): Promise<CustomerCartSnapshot | null>;
  updateItem(
    actorId: string,
    cartItemId: string,
    input: UpdateCustomerCartItemInput,
  ): Promise<CustomerCartSnapshot | null>;
  removeItem(actorId: string, cartItemId: string): Promise<CustomerCartSnapshot | null>;
  clearCart(actorId: string): Promise<CustomerCartSnapshot | null>;
}

export class CustomerCartGatewayUnavailableError extends Error {
  public constructor() {
    super('Customer cart provider unavailable');
    this.name = 'CustomerCartGatewayUnavailableError';
  }
}

export class CustomerCartDataInvalidError extends Error {
  public constructor() {
    super('Customer cart data invalid');
    this.name = 'CustomerCartDataInvalidError';
  }
}

export class CustomerCartItemNotFoundError extends Error {
  public constructor() {
    super('Customer cart item not found');
    this.name = 'CustomerCartItemNotFoundError';
  }
}

export class CustomerCartVariantNotFoundError extends Error {
  public constructor() {
    super('Customer cart variant not found');
    this.name = 'CustomerCartVariantNotFoundError';
  }
}

export class CustomerCartShopConflictError extends Error {
  public constructor() {
    super('Customer cart belongs to another shop');
    this.name = 'CustomerCartShopConflictError';
  }
}

export class CustomerCartInsufficientInventoryError extends Error {
  public constructor() {
    super('Customer cart quantity unavailable');
    this.name = 'CustomerCartInsufficientInventoryError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerCartDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerCartDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new CustomerCartDataInvalidError();
  }

  return value;
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value);
  }

  return Number.NaN;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = parseNumeric(record[key]);

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CustomerCartDataInvalidError();
  }

  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNonNegativeInteger(record, key);

  if (value < 1) {
    throw new CustomerCartDataInvalidError();
  }

  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);

  if (Number.isNaN(Date.parse(value))) {
    throw new CustomerCartDataInvalidError();
  }

  return value;
}

function requireOperationalStatus(record: Record<string, unknown>): ShopOperationalStatus {
  const value = record['operationalStatus'];

  if (
    typeof value !== 'string' ||
    !SHOP_OPERATIONAL_STATUSES.some((candidate) => candidate === value)
  ) {
    throw new CustomerCartDataInvalidError();
  }

  return value as ShopOperationalStatus;
}

function parseCartItem(value: unknown): CustomerCartItemSnapshot {
  if (!isRecord(value)) {
    throw new CustomerCartDataInvalidError();
  }

  const quantity = requirePositiveInteger(value, 'quantity');
  const unitPricePaise = requireNonNegativeInteger(value, 'unitPricePaise');
  const currentUnitPricePaise = requireNonNegativeInteger(value, 'currentUnitPricePaise');
  const lineTotalPaise = requireNonNegativeInteger(value, 'lineTotalPaise');
  const currentLineTotalPaise = requireNonNegativeInteger(value, 'currentLineTotalPaise');

  if (
    lineTotalPaise !== quantity * unitPricePaise ||
    currentLineTotalPaise !== quantity * currentUnitPricePaise
  ) {
    throw new CustomerCartDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    variantId: requireString(value, 'variantId'),
    productId: requireString(value, 'productId'),
    productName: requireString(value, 'productName'),
    productSlug: requireString(value, 'productSlug'),
    sku: requireString(value, 'sku'),
    colourName: requireNullableString(value, 'colourName'),
    sizeLabel: requireNullableString(value, 'sizeLabel'),
    imageObjectKey: requireNullableString(value, 'imageObjectKey'),
    quantity,
    unitPricePaise,
    currentUnitPricePaise,
    priceChanged: requireBoolean(value, 'priceChanged'),
    availableQuantity: requireNonNegativeInteger(value, 'availableQuantity'),
    isAvailable: requireBoolean(value, 'isAvailable'),
    lineTotalPaise,
    currentLineTotalPaise,
    addedAt: requireTimestamp(value, 'addedAt'),
    updatedAt: requireTimestamp(value, 'updatedAt'),
  };
}

function parseCart(value: unknown): CustomerCartSnapshot {
  if (!isRecord(value)) {
    throw new CustomerCartDataInvalidError();
  }

  const shopValue = value['shop'];
  const itemsValue = value['items'];

  if (!isRecord(shopValue) || !Array.isArray(itemsValue)) {
    throw new CustomerCartDataInvalidError();
  }

  const items = itemsValue.map((item) => parseCartItem(item));
  const itemCount = requireNonNegativeInteger(value, 'itemCount');
  const subtotalPaise = requireNonNegativeInteger(value, 'subtotalPaise');
  const currentSubtotalPaise = requireNonNegativeInteger(value, 'currentSubtotalPaise');

  if (
    itemCount !== items.reduce((total, item) => total + item.quantity, 0) ||
    subtotalPaise !== items.reduce((total, item) => total + item.lineTotalPaise, 0) ||
    currentSubtotalPaise !== items.reduce((total, item) => total + item.currentLineTotalPaise, 0)
  ) {
    throw new CustomerCartDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    shop: {
      id: requireString(shopValue, 'id'),
      name: requireString(shopValue, 'name'),
      slug: requireString(shopValue, 'slug'),
      logoObjectKey: requireNullableString(shopValue, 'logoObjectKey'),
      operationalStatus: requireOperationalStatus(shopValue),
      acceptsOnlineOrders: requireBoolean(shopValue, 'acceptsOnlineOrders'),
    },
    items,
    itemCount,
    subtotalPaise,
    currentSubtotalPaise,
    hasPriceChanges: requireBoolean(value, 'hasPriceChanges'),
    hasUnavailableItems: requireBoolean(value, 'hasUnavailableItems'),
    createdAt: requireTimestamp(value, 'createdAt'),
    updatedAt: requireTimestamp(value, 'updatedAt'),
  };
}

function parseCartPayload(value: unknown): CustomerCartSnapshot | null {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'cart')) {
    throw new CustomerCartDataInvalidError();
  }

  if (value['cart'] === null) {
    return null;
  }

  return parseCart(value['cart']);
}

function mapRpcError(error: { readonly code?: string }): Error {
  if (error.code === 'P0002') {
    return new CustomerCartItemNotFoundError();
  }

  if (error.code === 'P0003') {
    return new CustomerCartShopConflictError();
  }

  if (error.code === 'P0005') {
    return new CustomerCartVariantNotFoundError();
  }

  if (error.code === 'P0004') {
    return new CustomerCartInsufficientInventoryError();
  }

  return new CustomerCartGatewayUnavailableError();
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof CustomerCartGatewayUnavailableError ||
    error instanceof CustomerCartDataInvalidError ||
    error instanceof CustomerCartItemNotFoundError ||
    error instanceof CustomerCartVariantNotFoundError ||
    error instanceof CustomerCartShopConflictError ||
    error instanceof CustomerCartInsufficientInventoryError
  ) {
    throw error;
  }

  throw new CustomerCartGatewayUnavailableError();
}

@Injectable()
export class SupabaseCustomerCartGateway implements CustomerCartGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async getCart(client: SupabaseClient): Promise<CustomerCartSnapshot | null> {
    return this.execute(client, 'get_customer_cart', {});
  }

  public async setItem(
    actorId: string,
    input: SetCustomerCartItemInput,
  ): Promise<CustomerCartSnapshot | null> {
    return this.execute(this.trustedClient, 'set_customer_cart_item', {
      p_actor: actorId,
      p_variant_id: input.variantId,
      p_quantity: input.quantity,
      p_replace_existing_cart: input.replaceExistingCart,
    });
  }

  public async updateItem(
    actorId: string,
    cartItemId: string,
    input: UpdateCustomerCartItemInput,
  ): Promise<CustomerCartSnapshot | null> {
    return this.execute(this.trustedClient, 'update_customer_cart_item', {
      p_actor: actorId,
      p_cart_item_id: cartItemId,
      p_quantity: input.quantity,
    });
  }

  public async removeItem(
    actorId: string,
    cartItemId: string,
  ): Promise<CustomerCartSnapshot | null> {
    return this.execute(this.trustedClient, 'remove_customer_cart_item', {
      p_actor: actorId,
      p_cart_item_id: cartItemId,
    });
  }

  public async clearCart(actorId: string): Promise<CustomerCartSnapshot | null> {
    return this.execute(this.trustedClient, 'clear_customer_cart', {
      p_actor: actorId,
    });
  }

  private async execute(
    client: SupabaseClient,
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<CustomerCartSnapshot | null> {
    try {
      const response = await client.rpc(functionName, args);

      if (response.error !== null) {
        throw mapRpcError(response.error);
      }

      return parseCartPayload(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
