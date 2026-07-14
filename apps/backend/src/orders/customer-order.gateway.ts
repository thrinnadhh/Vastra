import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CustomerCodOrderSnapshot,
  CustomerOrderAddressSnapshot,
  CustomerOrderItemSnapshot,
  CustomerOrderShopSnapshot,
  CustomerOrderTotalsSnapshot,
  PlaceCustomerCodOrderInput,
} from './customer-order.types';

export interface CustomerOrderGateway {
  placeCodOrder(
    actorId: string,
    input: PlaceCustomerCodOrderInput,
  ): Promise<CustomerCodOrderSnapshot>;
}

export class CustomerOrderGatewayUnavailableError extends Error {
  public constructor() {
    super('Customer order provider unavailable');
    this.name = 'CustomerOrderGatewayUnavailableError';
  }
}

export class CustomerOrderDataInvalidError extends Error {
  public constructor() {
    super('Customer order data invalid');
    this.name = 'CustomerOrderDataInvalidError';
  }
}

export class CustomerOrderCartNotFoundError extends Error {
  public constructor() {
    super('Customer order cart not found');
    this.name = 'CustomerOrderCartNotFoundError';
  }
}

export class CustomerOrderQuoteNotFoundError extends Error {
  public constructor() {
    super('Customer order quote not found');
    this.name = 'CustomerOrderQuoteNotFoundError';
  }
}

export class CustomerOrderQuoteExpiredError extends Error {
  public constructor() {
    super('Customer order quote expired');
    this.name = 'CustomerOrderQuoteExpiredError';
  }
}

export class CustomerOrderQuoteStaleError extends Error {
  public constructor() {
    super('Customer order quote stale');
    this.name = 'CustomerOrderQuoteStaleError';
  }
}

export class CustomerOrderIdempotencyConflictError extends Error {
  public constructor() {
    super('Customer order idempotency conflict');
    this.name = 'CustomerOrderIdempotencyConflictError';
  }
}

export class CustomerOrderShopUnavailableError extends Error {
  public constructor() {
    super('Customer order shop unavailable');
    this.name = 'CustomerOrderShopUnavailableError';
  }
}

export class CustomerOrderAddressNotServiceableError extends Error {
  public constructor() {
    super('Customer order address not serviceable');
    this.name = 'CustomerOrderAddressNotServiceableError';
  }
}

export class CustomerOrderInsufficientStockError extends Error {
  public constructor() {
    super('Customer order stock unavailable');
    this.name = 'CustomerOrderInsufficientStockError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerOrderDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerOrderDataInvalidError();
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
    throw new CustomerOrderDataInvalidError();
  }

  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNonNegativeInteger(record, key);
  if (value < 1) {
    throw new CustomerOrderDataInvalidError();
  }

  return value;
}

function requireFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = parseNumeric(record[key]);
  if (!Number.isFinite(value)) {
    throw new CustomerOrderDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new CustomerOrderDataInvalidError();
  }

  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (Number.isNaN(Date.parse(value))) {
    throw new CustomerOrderDataInvalidError();
  }

  return value;
}

function parseAddress(value: unknown): CustomerOrderAddressSnapshot {
  if (!isRecord(value)) {
    throw new CustomerOrderDataInvalidError();
  }

  const latitude = requireFiniteNumber(value, 'latitude');
  const longitude = requireFiniteNumber(value, 'longitude');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new CustomerOrderDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    label: requireNullableString(value, 'label'),
    recipientName: requireString(value, 'recipientName'),
    phoneNumber: requireString(value, 'phoneNumber'),
    line1: requireString(value, 'line1'),
    line2: requireNullableString(value, 'line2'),
    landmark: requireNullableString(value, 'landmark'),
    area: requireString(value, 'area'),
    city: requireString(value, 'city'),
    state: requireString(value, 'state'),
    postalCode: requireString(value, 'postalCode'),
    countryCode: requireString(value, 'countryCode'),
    latitude,
    longitude,
  };
}

function parseShop(value: unknown): CustomerOrderShopSnapshot {
  if (!isRecord(value)) {
    throw new CustomerOrderDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    name: requireString(value, 'name'),
    slug: requireString(value, 'slug'),
  };
}

function parseItem(value: unknown): CustomerOrderItemSnapshot {
  if (!isRecord(value)) {
    throw new CustomerOrderDataInvalidError();
  }

  const quantity = requirePositiveInteger(value, 'quantity');
  const unitMrpPaise = requireNonNegativeInteger(value, 'unitMrpPaise');
  const unitSellingPricePaise = requireNonNegativeInteger(value, 'unitSellingPricePaise');
  const discountPaise = requireNonNegativeInteger(value, 'discountPaise');
  const totalPaise = requireNonNegativeInteger(value, 'totalPaise');

  if (
    unitSellingPricePaise > unitMrpPaise ||
    discountPaise > quantity * unitSellingPricePaise ||
    totalPaise !== quantity * unitSellingPricePaise - discountPaise
  ) {
    throw new CustomerOrderDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    productId: requireString(value, 'productId'),
    variantId: requireString(value, 'variantId'),
    productName: requireString(value, 'productName'),
    sku: requireString(value, 'sku'),
    colourName: requireNullableString(value, 'colourName'),
    sizeLabel: requireNullableString(value, 'sizeLabel'),
    imageObjectKey: requireNullableString(value, 'imageObjectKey'),
    quantity,
    unitMrpPaise,
    unitSellingPricePaise,
    discountPaise,
    totalPaise,
  };
}

function parseTotals(value: unknown): CustomerOrderTotalsSnapshot {
  if (!isRecord(value)) {
    throw new CustomerOrderDataInvalidError();
  }

  const totals = {
    subtotalPaise: requireNonNegativeInteger(value, 'subtotalPaise'),
    productDiscountPaise: requireNonNegativeInteger(value, 'productDiscountPaise'),
    couponDiscountPaise: requireNonNegativeInteger(value, 'couponDiscountPaise'),
    deliveryFeePaise: requireNonNegativeInteger(value, 'deliveryFeePaise'),
    platformFeePaise: requireNonNegativeInteger(value, 'platformFeePaise'),
    taxPaise: requireNonNegativeInteger(value, 'taxPaise'),
    totalPaise: requireNonNegativeInteger(value, 'totalPaise'),
  };

  if (
    totals.productDiscountPaise + totals.couponDiscountPaise > totals.subtotalPaise ||
    totals.totalPaise !==
      totals.subtotalPaise -
        totals.productDiscountPaise -
        totals.couponDiscountPaise +
        totals.deliveryFeePaise +
        totals.platformFeePaise +
        totals.taxPaise
  ) {
    throw new CustomerOrderDataInvalidError();
  }

  return totals;
}

function parseOrder(value: unknown): CustomerCodOrderSnapshot {
  if (!isRecord(value)) {
    throw new CustomerOrderDataInvalidError();
  }

  const itemsValue = value['items'];
  if (!Array.isArray(itemsValue) || itemsValue.length === 0) {
    throw new CustomerOrderDataInvalidError();
  }

  if (
    value['status'] !== 'WAITING_FOR_MERCHANT' ||
    value['paymentStatus'] !== 'COD_PENDING' ||
    value['paymentMethod'] !== 'COD' ||
    value['fulfilmentType'] !== 'DELIVERY'
  ) {
    throw new CustomerOrderDataInvalidError();
  }

  const items = itemsValue.map((item) => parseItem(item));
  const totals = parseTotals(value['totals']);
  if (totals.subtotalPaise !== items.reduce((sum, item) => sum + item.totalPaise, 0)) {
    throw new CustomerOrderDataInvalidError();
  }

  const placedAt = requireTimestamp(value, 'placedAt');
  const estimatedDeliveryAt = requireTimestamp(value, 'estimatedDeliveryAt');
  if (Date.parse(estimatedDeliveryAt) < Date.parse(placedAt)) {
    throw new CustomerOrderDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    orderNumber: requireString(value, 'orderNumber'),
    cartId: requireString(value, 'cartId'),
    quoteId: requireString(value, 'quoteId'),
    shop: parseShop(value['shop']),
    address: parseAddress(value['address']),
    status: 'WAITING_FOR_MERCHANT',
    paymentStatus: 'COD_PENDING',
    paymentMethod: 'COD',
    fulfilmentType: 'DELIVERY',
    items,
    totals,
    estimatedDeliveryAt,
    customerNote: requireNullableString(value, 'customerNote'),
    placedAt,
    replayed: requireBoolean(value, 'replayed'),
  };
}

function mapRpcError(error: { readonly code?: string }): Error {
  if (error.code === undefined) {
    return new CustomerOrderGatewayUnavailableError();
  }

  switch (error.code) {
    case 'P0001':
      return new CustomerOrderInsufficientStockError();
    case 'P0002':
      return new CustomerOrderCartNotFoundError();
    case 'P0007':
      return new CustomerOrderShopUnavailableError();
    case 'P0008':
      return new CustomerOrderAddressNotServiceableError();
    case 'P0010':
      return new CustomerOrderIdempotencyConflictError();
    case 'P0011':
      return new CustomerOrderQuoteNotFoundError();
    case 'P0012':
      return new CustomerOrderQuoteExpiredError();
    case 'P0013':
      return new CustomerOrderQuoteStaleError();
    default:
      return new CustomerOrderGatewayUnavailableError();
  }
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof CustomerOrderGatewayUnavailableError ||
    error instanceof CustomerOrderDataInvalidError ||
    error instanceof CustomerOrderCartNotFoundError ||
    error instanceof CustomerOrderQuoteNotFoundError ||
    error instanceof CustomerOrderQuoteExpiredError ||
    error instanceof CustomerOrderQuoteStaleError ||
    error instanceof CustomerOrderIdempotencyConflictError ||
    error instanceof CustomerOrderShopUnavailableError ||
    error instanceof CustomerOrderAddressNotServiceableError ||
    error instanceof CustomerOrderInsufficientStockError
  ) {
    throw error;
  }

  throw new CustomerOrderGatewayUnavailableError();
}

@Injectable()
export class SupabaseCustomerOrderGateway implements CustomerOrderGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async placeCodOrder(
    actorId: string,
    input: PlaceCustomerCodOrderInput,
  ): Promise<CustomerCodOrderSnapshot> {
    try {
      const response = await this.trustedClient.rpc('place_customer_cod_order', {
        p_actor: actorId,
        p_cart_id: input.cartId,
        p_quote_id: input.quoteId,
        p_address_id: input.addressId,
        p_customer_note: input.customerNote,
        p_idempotency_key: input.idempotencyKey,
      });

      if (response.error !== null) {
        throw mapRpcError(response.error);
      }

      return parseOrder(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
