import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CreateCustomerCheckoutQuoteInput,
  CustomerCheckoutQuoteAddressSnapshot,
  CustomerCheckoutQuoteBranchSnapshot,
  CustomerCheckoutQuoteCommercialSnapshot,
  CustomerCheckoutQuoteGeographySnapshot,
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

export class CustomerCheckoutQuoteCartNotFoundError extends Error {}
export class CustomerCheckoutQuoteAddressNotFoundError extends Error {}
export class CustomerCheckoutQuoteShopUnavailableError extends Error {}
export class CustomerCheckoutQuoteOutsideServiceAreaError extends Error {}
export class CustomerCheckoutQuoteMinimumOrderError extends Error {}
export class CustomerCheckoutQuoteInsufficientInventoryError extends Error {}
export class CustomerCheckoutQuoteNoFulfilmentBranchError extends Error {}
export class CustomerCheckoutQuotePostalPricingRequiredError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new CustomerCheckoutQuoteDataInvalidError();
  return value;
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
  if (value === null) return null;
  if (typeof value !== 'string') throw new CustomerCheckoutQuoteDataInvalidError();
  return value;
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) return Number(value);
  return Number.NaN;
}

function requireInteger(
  record: Record<string, unknown>,
  key: string,
  minimum = 0,
): number {
  const value = parseNumeric(record[key]);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = parseNumeric(record[key]);
  if (!Number.isFinite(value)) throw new CustomerCheckoutQuoteDataInvalidError();
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw new CustomerCheckoutQuoteDataInvalidError();
  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (Number.isNaN(Date.parse(value))) throw new CustomerCheckoutQuoteDataInvalidError();
  return value;
}

function requirePolicy(record: Record<string, unknown>, key: string): Readonly<Record<string, unknown>> {
  return requireRecord(record[key]);
}

function parseAddress(value: unknown): CustomerCheckoutQuoteAddressSnapshot {
  const record = requireRecord(value);
  const latitude = requireNumber(record, 'latitude');
  const longitude = requireNumber(record, 'longitude');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }
  return {
    id: requireString(record, 'id'),
    label: requireNullableString(record, 'label'),
    recipientName: requireString(record, 'recipientName'),
    phoneNumber: requireString(record, 'phoneNumber'),
    line1: requireString(record, 'line1'),
    line2: requireNullableString(record, 'line2'),
    landmark: requireNullableString(record, 'landmark'),
    area: requireString(record, 'area'),
    city: requireString(record, 'city'),
    state: requireString(record, 'state'),
    postalCode: requireString(record, 'postalCode'),
    countryCode: requireString(record, 'countryCode'),
    latitude,
    longitude,
  };
}

function parseShop(value: unknown): CustomerCheckoutQuoteShopSnapshot {
  const record = requireRecord(value);
  return {
    id: requireString(record, 'id'),
    name: requireString(record, 'name'),
    slug: requireString(record, 'slug'),
    minimumOrderPaise: requireInteger(record, 'minimumOrderPaise'),
  };
}

function parseBranch(value: unknown): CustomerCheckoutQuoteBranchSnapshot {
  const record = requireRecord(value);
  const type = record['type'];
  if (type !== 'PHYSICAL_STORE' && type !== 'CLOUD_SHOP') {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }
  const latitude = requireNumber(record, 'latitude');
  const longitude = requireNumber(record, 'longitude');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }
  return {
    id: requireString(record, 'id'),
    code: requireString(record, 'code'),
    name: requireString(record, 'name'),
    type,
    addressId: requireString(record, 'addressId'),
    returnAddressId: requireString(record, 'returnAddressId'),
    pincode: requireNullableString(record, 'pincode'),
    latitude,
    longitude,
  };
}

function parseGeography(value: unknown): CustomerCheckoutQuoteGeographySnapshot {
  const record = requireRecord(value);
  if (record['fulfilmentMode'] !== 'LOCAL_DELIVERY') {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }
  const distanceMeters = requireInteger(record, 'distanceMeters');
  const deliveryRadiusMeters = requireInteger(record, 'deliveryRadiusMeters', 1);
  if (distanceMeters > deliveryRadiusMeters) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }
  return {
    cityId: requireString(record, 'cityId'),
    cityCode: requireString(record, 'cityCode'),
    cityName: requireString(record, 'cityName'),
    serviceZoneId: requireString(record, 'serviceZoneId'),
    serviceZoneCode: requireString(record, 'serviceZoneCode'),
    serviceZoneName: requireString(record, 'serviceZoneName'),
    customerPincode: requireString(record, 'customerPincode'),
    fulfilmentMode: 'LOCAL_DELIVERY',
    distanceMeters,
    deliveryRadiusMeters,
  };
}

function parseCommercial(value: unknown): CustomerCheckoutQuoteCommercialSnapshot {
  const record = requireRecord(value);
  return {
    deliveryFeePaise: requireInteger(record, 'deliveryFeePaise'),
    codEligible: requireBoolean(record, 'codEligible'),
    codLimitPaise: requireInteger(record, 'codLimitPaise'),
    merchantCommissionBps: requireInteger(record, 'merchantCommissionBps'),
    cityConfigurationVersion: requireInteger(record, 'cityConfigurationVersion', 1),
    cancellationPolicy: requirePolicy(record, 'cancellationPolicy'),
    refundPolicy: requirePolicy(record, 'refundPolicy'),
  };
}

function parseItem(value: unknown): CustomerCheckoutQuoteItemSnapshot {
  const record = requireRecord(value);
  const quantity = requireInteger(record, 'quantity', 1);
  const previousUnitPricePaise = requireInteger(record, 'previousUnitPricePaise');
  const unitPricePaise = requireInteger(record, 'unitPricePaise');
  const availableQuantity = requireInteger(record, 'availableQuantity');
  const lineTotalPaise = requireInteger(record, 'lineTotalPaise');
  const priceChanged = requireBoolean(record, 'priceChanged');
  if (
    lineTotalPaise !== quantity * unitPricePaise ||
    availableQuantity < quantity ||
    priceChanged !== (previousUnitPricePaise !== unitPricePaise)
  ) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }
  return {
    cartItemId: requireString(record, 'cartItemId'),
    variantId: requireString(record, 'variantId'),
    productId: requireString(record, 'productId'),
    productName: requireString(record, 'productName'),
    sku: requireString(record, 'sku'),
    colourName: requireNullableString(record, 'colourName'),
    sizeLabel: requireNullableString(record, 'sizeLabel'),
    quantity,
    previousUnitPricePaise,
    unitPricePaise,
    priceChanged,
    availableQuantity,
    branchInventoryVersion: requireInteger(record, 'branchInventoryVersion', 1),
    lineTotalPaise,
  };
}

function parseTotals(value: unknown): CustomerCheckoutQuoteTotalsSnapshot {
  const record = requireRecord(value);
  const totals = {
    subtotalPaise: requireInteger(record, 'subtotalPaise'),
    productDiscountPaise: requireInteger(record, 'productDiscountPaise'),
    couponDiscountPaise: requireInteger(record, 'couponDiscountPaise'),
    deliveryFeePaise: requireInteger(record, 'deliveryFeePaise'),
    platformFeePaise: requireInteger(record, 'platformFeePaise'),
    taxPaise: requireInteger(record, 'taxPaise'),
    totalPaise: requireInteger(record, 'totalPaise'),
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
  const record = requireRecord(value);
  if (record['contractVersion'] !== 2 || record['fulfilmentMode'] !== 'LOCAL_DELIVERY') {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }
  const rawItems = record['items'];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }
  const items = rawItems.map(parseItem);
  const totals = parseTotals(record['totals']);
  const branch = parseBranch(record['branch']);
  const geography = parseGeography(record['geography']);
  const codEligible = requireBoolean(record, 'codEligible');
  const codLimitPaise = requireInteger(record, 'codLimitPaise');
  const cityConfigurationVersion = requireInteger(record, 'cityConfigurationVersion', 1);
  if (
    totals.subtotalPaise !== items.reduce((sum, item) => sum + item.lineTotalPaise, 0) ||
    branch.id.length === 0 ||
    geography.fulfilmentMode !== 'LOCAL_DELIVERY' ||
    codEligible !== (totals.totalPaise <= codLimitPaise)
  ) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }
  const createdAt = requireTimestamp(record, 'createdAt');
  const expiresAt = requireTimestamp(record, 'expiresAt');
  const estimatedDeliveryAt = requireTimestamp(record, 'estimatedDeliveryAt');
  if (Date.parse(expiresAt) <= Date.parse(createdAt) || Date.parse(estimatedDeliveryAt) < Date.parse(createdAt)) {
    throw new CustomerCheckoutQuoteDataInvalidError();
  }
  return {
    id: requireString(record, 'id'),
    contractVersion: 2,
    cartId: requireString(record, 'cartId'),
    address: parseAddress(record['address']),
    shop: parseShop(record['shop']),
    branch,
    geography,
    items,
    totals,
    fulfilmentMode: 'LOCAL_DELIVERY',
    codEligible,
    codLimitPaise,
    estimatedPreparationMinutes: requireInteger(record, 'estimatedPreparationMinutes'),
    estimatedTravelMinutes: requireInteger(record, 'estimatedTravelMinutes'),
    estimatedDeliveryAt,
    cityConfigurationVersion,
    expiresAt,
    createdAt,
  };
}

function mapRpcError(error: { readonly code?: string }): Error {
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
    case 'P0021':
      return new CustomerCheckoutQuoteNoFulfilmentBranchError();
    case 'P0022':
      return new CustomerCheckoutQuotePostalPricingRequiredError();
    default:
      return new CustomerCheckoutQuoteGatewayUnavailableError();
  }
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
      const response = await this.trustedClient.rpc('create_customer_branch_checkout_quote', {
        p_actor: actorId,
        p_address_id: input.addressId,
      });
      if (response.error !== null) throw mapRpcError(response.error);
      return parseQuote(response.data);
    } catch (error: unknown) {
      if (error instanceof Error) throw error;
      throw new CustomerCheckoutQuoteGatewayUnavailableError();
    }
  }
}
