import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CreateCustomerCheckoutQuoteInput,
  CustomerCheckoutQuoteAddressSnapshot,
  CustomerCheckoutQuoteItemSnapshot,
  CustomerCheckoutQuoteShopSnapshot,
  CustomerCheckoutQuoteSnapshot,
  CustomerCheckoutQuoteTotalsSnapshot,
} from './customer-checkout-quote.types';

export interface CustomerCheckoutQuoteGateway {
  createQuote(
    actorId: string,
    input: CreateCustomerCheckoutQuoteInput,
  ): Promise<CustomerCheckoutQuoteSnapshot>;
}

export class CustomerCheckoutQuoteGatewayUnavailableError extends Error {
  public constructor() {
    super('Customer checkout quote provider unavailable');
    this.name = 'CustomerCheckoutQuoteGatewayUnavailableError';
  }
}

export class CustomerCheckoutQuoteDataInvalidError extends Error {
  public constructor() {
    super('Customer checkout quote data invalid');
    this.name = 'CustomerCheckoutQuoteDataInvalidError';
  }
}

export class CustomerCheckoutQuoteCartNotFoundError extends Error {
  public constructor() {
    super('Customer checkout cart not found');
    this.name = 'CustomerCheckoutQuoteCartNotFoundError';
  }
}

export class CustomerCheckoutQuoteAddressNotFoundError extends Error {
  public constructor() {
    super('Customer checkout address not found');
    this.name = 'CustomerCheckoutQuoteAddressNotFoundError';
  }
}

export class CustomerCheckoutQuoteShopUnavailableError extends Error {
  public constructor() {
    super('Customer checkout shop unavailable');
    this.name = 'CustomerCheckoutQuoteShopUnavailableError';
  }
}

export class CustomerCheckoutQuoteOutsideServiceAreaError extends Error {
  public constructor() {
    super('Customer checkout address outside service area');
    this.name = 'CustomerCheckoutQuoteOutsideServiceAreaError';
  }
}

export class CustomerCheckoutQuoteMinimumOrderError extends Error {
  public constructor() {
    super('Customer checkout minimum order not met');
    this.name = 'CustomerCheckoutQuoteMinimumOrderError';
  }
}

export class CustomerCheckoutQuoteInsufficientInventoryError extends Error {
  public constructor() {
    super('Customer checkout inventory unavailable');
    this.name = 'CustomerCheckoutQuoteInsufficientInventoryError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerCheckoutQuoteDataInvalidError();
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

function requireFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = parseNumeric(record[key]);
  if (!Number.isFinite(value)) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  return value;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = parseNumeric(record[key]);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNonNegativeInteger(record, key);
  if (value < 1) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (Number.isNaN(Date.parse(value))) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  return value;
}

function parseAddress(value: unknown): CustomerCheckoutQuoteAddressSnapshot {
  if (!isRecord(value)) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  const latitude = requireFiniteNumber(value, 'latitude');
  const longitude = requireFiniteNumber(value, 'longitude');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new CustomerCheckoutQuoteDataInvalidError();
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

function parseShop(value: unknown): CustomerCheckoutQuoteShopSnapshot {
  if (!isRecord(value)) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  const distanceMeters = requireNonNegativeInteger(value, 'distanceMeters');
  const serviceRadiusMeters = requirePositiveInteger(value, 'serviceRadiusMeters');
  if (distanceMeters > serviceRadiusMeters) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    name: requireString(value, 'name'),
    slug: requireString(value, 'slug'),
    minimumOrderPaise: requireNonNegativeInteger(value, 'minimumOrderPaise'),
    averagePreparationMinutes: requireNonNegativeInteger(value, 'averagePreparationMinutes'),
    distanceMeters,
    serviceRadiusMeters,
  };
}

function parseItem(value: unknown): CustomerCheckoutQuoteItemSnapshot {
  if (!isRecord(value)) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  const quantity = requirePositiveInteger(value, 'quantity');
  const previousUnitPricePaise = requireNonNegativeInteger(value, 'previousUnitPricePaise');
  const unitPricePaise = requireNonNegativeInteger(value, 'unitPricePaise');
  const availableQuantity = requireNonNegativeInteger(value, 'availableQuantity');
  const lineTotalPaise = requireNonNegativeInteger(value, 'lineTotalPaise');
  const priceChanged = requireBoolean(value, 'priceChanged');

  if (
    lineTotalPaise !== quantity * unitPricePaise ||
    availableQuantity < quantity ||
    priceChanged !== (previousUnitPricePaise !== unitPricePaise)
  ) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  return {
    cartItemId: requireString(value, 'cartItemId'),
    variantId: requireString(value, 'variantId'),
    productId: requireString(value, 'productId'),
    productName: requireString(value, 'productName'),
    sku: requireString(value, 'sku'),
    colourName: requireNullableString(value, 'colourName'),
    sizeLabel: requireNullableString(value, 'sizeLabel'),
    quantity,
    previousUnitPricePaise,
    unitPricePaise,
    priceChanged,
    availableQuantity,
    inventoryVersion: requirePositiveInteger(value, 'inventoryVersion'),
    lineTotalPaise,
  };
}

function parseTotals(value: unknown): CustomerCheckoutQuoteTotalsSnapshot {
  if (!isRecord(value)) {
    throw new CustomerCheckoutQuoteDataInvalidError();
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
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  return totals;
}

function parseQuote(value: unknown): CustomerCheckoutQuoteSnapshot {
  if (!isRecord(value)) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  const itemsValue = value['items'];
  if (!Array.isArray(itemsValue) || itemsValue.length === 0) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  const items = itemsValue.map((item) => parseItem(item));
  const totals = parseTotals(value['totals']);
  if (totals.subtotalPaise !== items.reduce((sum, item) => sum + item.lineTotalPaise, 0)) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  const createdAt = requireTimestamp(value, 'createdAt');
  const expiresAt = requireTimestamp(value, 'expiresAt');
  const estimatedDeliveryAt = requireTimestamp(value, 'estimatedDeliveryAt');
  if (
    Date.parse(expiresAt) <= Date.parse(createdAt) ||
    Date.parse(estimatedDeliveryAt) < Date.parse(createdAt)
  ) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    cartId: requireString(value, 'cartId'),
    address: parseAddress(value['address']),
    shop: parseShop(value['shop']),
    items,
    totals,
    estimatedPreparationMinutes: requireNonNegativeInteger(value, 'estimatedPreparationMinutes'),
    estimatedTravelMinutes: requireNonNegativeInteger(value, 'estimatedTravelMinutes'),
    estimatedDeliveryAt,
    expiresAt,
    createdAt,
  };
}

function mapRpcError(error: { readonly code?: string }): Error {
  if (error.code === undefined) {
    return new CustomerCheckoutQuoteGatewayUnavailableError();
  }

  switch (error.code) {
    case 'P0002':
      return new CustomerCheckoutQuoteCartNotFoundError();
    case 'P0014':
      return new CustomerCheckoutQuoteInsufficientInventoryError();
    case 'P0006':
      return new CustomerCheckoutQuoteAddressNotFoundError();
    case 'P0007':
      return new CustomerCheckoutQuoteShopUnavailableError();
    case 'P0008':
      return new CustomerCheckoutQuoteOutsideServiceAreaError();
    case 'P0009':
      return new CustomerCheckoutQuoteMinimumOrderError();
    default:
      return new CustomerCheckoutQuoteGatewayUnavailableError();
  }
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof CustomerCheckoutQuoteGatewayUnavailableError ||
    error instanceof CustomerCheckoutQuoteDataInvalidError ||
    error instanceof CustomerCheckoutQuoteCartNotFoundError ||
    error instanceof CustomerCheckoutQuoteAddressNotFoundError ||
    error instanceof CustomerCheckoutQuoteShopUnavailableError ||
    error instanceof CustomerCheckoutQuoteOutsideServiceAreaError ||
    error instanceof CustomerCheckoutQuoteMinimumOrderError ||
    error instanceof CustomerCheckoutQuoteInsufficientInventoryError
  ) {
    throw error;
  }

  throw new CustomerCheckoutQuoteGatewayUnavailableError();
}

@Injectable()
export class SupabaseCustomerCheckoutQuoteGateway implements CustomerCheckoutQuoteGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async createQuote(
    actorId: string,
    input: CreateCustomerCheckoutQuoteInput,
  ): Promise<CustomerCheckoutQuoteSnapshot> {
    try {
      const response = await this.trustedClient.rpc('create_customer_checkout_quote', {
        p_actor: actorId,
        p_address_id: input.addressId,
      });

      if (response.error !== null) {
        throw mapRpcError(response.error);
      }

      return parseQuote(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
