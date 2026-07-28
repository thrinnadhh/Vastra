import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CustomerCodOrderSnapshot,
  CustomerOrderAddressSnapshot,
  CustomerOrderBranchSnapshot,
  CustomerOrderCommercialSnapshot,
  CustomerOrderGeographySnapshot,
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

export class CustomerOrderGatewayUnavailableError extends Error {}
export class CustomerOrderDataInvalidError extends Error {}
export class CustomerOrderCartNotFoundError extends Error {}
export class CustomerOrderQuoteNotFoundError extends Error {}
export class CustomerOrderQuoteExpiredError extends Error {}
export class CustomerOrderQuoteStaleError extends Error {}
export class CustomerOrderIdempotencyConflictError extends Error {}
export class CustomerOrderShopUnavailableError extends Error {}
export class CustomerOrderAddressNotServiceableError extends Error {}
export class CustomerOrderInsufficientStockError extends Error {}
export class CustomerOrderQuoteVersionUnsupportedError extends Error {}
export class CustomerOrderNoFulfilmentBranchError extends Error {}
export class CustomerOrderPostalPricingRequiredError extends Error {}
export class CustomerOrderBranchUnavailableError extends Error {}
export class CustomerOrderCodNotEligibleError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new CustomerOrderDataInvalidError();
  return value;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerOrderDataInvalidError();
  }
  return value;
}

function nullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') throw new CustomerOrderDataInvalidError();
  return value;
}

function numeric(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) return Number(value);
  return Number.NaN;
}

function integer(record: Record<string, unknown>, key: string, minimum = 0): number {
  const value = numeric(record[key]);
  if (!Number.isSafeInteger(value) || value < minimum) throw new CustomerOrderDataInvalidError();
  return value;
}

function finite(record: Record<string, unknown>, key: string): number {
  const value = numeric(record[key]);
  if (!Number.isFinite(value)) throw new CustomerOrderDataInvalidError();
  return value;
}

function boolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw new CustomerOrderDataInvalidError();
  return value;
}

function timestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (Number.isNaN(Date.parse(value))) throw new CustomerOrderDataInvalidError();
  return value;
}

function parseAddress(value: unknown): CustomerOrderAddressSnapshot {
  const record = requireRecord(value);
  const latitude = finite(record, 'latitude');
  const longitude = finite(record, 'longitude');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new CustomerOrderDataInvalidError();
  }
  return {
    id: requireString(record, 'id'),
    label: nullableString(record, 'label'),
    recipientName: requireString(record, 'recipientName'),
    phoneNumber: requireString(record, 'phoneNumber'),
    line1: requireString(record, 'line1'),
    line2: nullableString(record, 'line2'),
    landmark: nullableString(record, 'landmark'),
    area: requireString(record, 'area'),
    city: requireString(record, 'city'),
    state: requireString(record, 'state'),
    postalCode: requireString(record, 'postalCode'),
    countryCode: requireString(record, 'countryCode'),
    latitude,
    longitude,
  };
}

function parseShop(value: unknown): CustomerOrderShopSnapshot {
  const record = requireRecord(value);
  return {
    id: requireString(record, 'id'),
    name: requireString(record, 'name'),
    slug: requireString(record, 'slug'),
  };
}

function parseBranch(value: unknown): CustomerOrderBranchSnapshot {
  const record = requireRecord(value);
  const type = record['type'];
  if (type !== 'PHYSICAL_STORE' && type !== 'CLOUD_SHOP') throw new CustomerOrderDataInvalidError();
  return {
    id: requireString(record, 'id'),
    code: requireString(record, 'code'),
    name: requireString(record, 'name'),
    type,
    addressId: requireString(record, 'addressId'),
    returnAddressId: requireString(record, 'returnAddressId'),
    pincode: nullableString(record, 'pincode'),
    latitude: finite(record, 'latitude'),
    longitude: finite(record, 'longitude'),
  };
}

function parseGeography(value: unknown): CustomerOrderGeographySnapshot {
  const record = requireRecord(value);
  if (record['fulfilmentMode'] !== 'LOCAL_DELIVERY') throw new CustomerOrderDataInvalidError();
  const distanceMeters = integer(record, 'distanceMeters');
  const deliveryRadiusMeters = integer(record, 'deliveryRadiusMeters', 1);
  if (distanceMeters > deliveryRadiusMeters) throw new CustomerOrderDataInvalidError();
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

function parseCommercial(value: unknown): CustomerOrderCommercialSnapshot {
  const record = requireRecord(value);
  return {
    deliveryFeePaise: integer(record, 'deliveryFeePaise'),
    codEligible: boolean(record, 'codEligible'),
    codLimitPaise: integer(record, 'codLimitPaise'),
    merchantCommissionBps: integer(record, 'merchantCommissionBps'),
    cityConfigurationVersion: integer(record, 'cityConfigurationVersion', 1),
    cancellationPolicy: requireRecord(record['cancellationPolicy']),
    refundPolicy: requireRecord(record['refundPolicy']),
  };
}

function parseItem(value: unknown): CustomerOrderItemSnapshot {
  const record = requireRecord(value);
  const quantity = integer(record, 'quantity', 1);
  const unitMrpPaise = integer(record, 'unitMrpPaise');
  const unitSellingPricePaise = integer(record, 'unitSellingPricePaise');
  const discountPaise = integer(record, 'discountPaise');
  const totalPaise = integer(record, 'totalPaise');
  if (
    unitSellingPricePaise > unitMrpPaise ||
    discountPaise > quantity * unitSellingPricePaise ||
    totalPaise !== quantity * unitSellingPricePaise - discountPaise
  ) {
    throw new CustomerOrderDataInvalidError();
  }
  return {
    id: requireString(record, 'id'),
    productId: requireString(record, 'productId'),
    variantId: requireString(record, 'variantId'),
    productName: requireString(record, 'productName'),
    sku: requireString(record, 'sku'),
    colourName: nullableString(record, 'colourName'),
    sizeLabel: nullableString(record, 'sizeLabel'),
    imageObjectKey: nullableString(record, 'imageObjectKey'),
    quantity,
    unitMrpPaise,
    unitSellingPricePaise,
    discountPaise,
    totalPaise,
    branchInventoryVersion: integer(record, 'branchInventoryVersion', 1),
    branchInventoryReservationId: requireString(record, 'branchInventoryReservationId'),
  };
}

function parseTotals(value: unknown): CustomerOrderTotalsSnapshot {
  const record = requireRecord(value);
  const totals = {
    subtotalPaise: integer(record, 'subtotalPaise'),
    productDiscountPaise: integer(record, 'productDiscountPaise'),
    couponDiscountPaise: integer(record, 'couponDiscountPaise'),
    deliveryFeePaise: integer(record, 'deliveryFeePaise'),
    platformFeePaise: integer(record, 'platformFeePaise'),
    taxPaise: integer(record, 'taxPaise'),
    totalPaise: integer(record, 'totalPaise'),
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
  const record = requireRecord(value);
  if (
    record['contractVersion'] !== 2 ||
    record['status'] !== 'WAITING_FOR_MERCHANT' ||
    record['paymentStatus'] !== 'COD_PENDING' ||
    record['paymentMethod'] !== 'COD' ||
    record['fulfilmentType'] !== 'DELIVERY' ||
    record['fulfilmentMode'] !== 'LOCAL_DELIVERY'
  ) {
    throw new CustomerOrderDataInvalidError();
  }
  const rawItems = record['items'];
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new CustomerOrderDataInvalidError();
  const items = rawItems.map(parseItem);
  const totals = parseTotals(record['totals']);
  const commercial = parseCommercial(record['commercial']);
  if (
    totals.subtotalPaise !== items.reduce((sum, item) => sum + item.totalPaise, 0) ||
    totals.deliveryFeePaise !== commercial.deliveryFeePaise ||
    !commercial.codEligible ||
    totals.totalPaise > commercial.codLimitPaise
  ) {
    throw new CustomerOrderDataInvalidError();
  }
  const placedAt = timestamp(record, 'placedAt');
  const estimatedDeliveryAt = timestamp(record, 'estimatedDeliveryAt');
  if (Date.parse(estimatedDeliveryAt) < Date.parse(placedAt))
    throw new CustomerOrderDataInvalidError();
  const replayed = record['replayed'];
  if (typeof replayed !== 'boolean') throw new CustomerOrderDataInvalidError();
  return {
    id: requireString(record, 'id'),
    orderNumber: requireString(record, 'orderNumber'),
    cartId: requireString(record, 'cartId'),
    quoteId: requireString(record, 'quoteId'),
    contractVersion: 2,
    shop: parseShop(record['shop']),
    branch: parseBranch(record['branch']),
    geography: parseGeography(record['geography']),
    commercial,
    address: parseAddress(record['address']),
    status: 'WAITING_FOR_MERCHANT',
    paymentStatus: 'COD_PENDING',
    paymentMethod: 'COD',
    fulfilmentType: 'DELIVERY',
    fulfilmentMode: 'LOCAL_DELIVERY',
    items,
    totals,
    estimatedDeliveryAt,
    customerNote: nullableString(record, 'customerNote'),
    placedAt,
    replayed,
  };
}

function mapRpcError(error: { readonly code?: string }): Error {
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
    case 'P0020':
      return new CustomerOrderQuoteVersionUnsupportedError();
    case 'P0021':
      return new CustomerOrderNoFulfilmentBranchError();
    case 'P0022':
      return new CustomerOrderPostalPricingRequiredError();
    case 'P0023':
      return new CustomerOrderBranchUnavailableError();
    case 'P0024':
      return new CustomerOrderCodNotEligibleError();
    default:
      return new CustomerOrderGatewayUnavailableError();
  }
}

function rethrow(error: unknown): never {
  if (error instanceof Error) throw error;
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
      const response = await this.trustedClient.rpc('place_customer_branch_cod_order', {
        p_actor: actorId,
        p_cart_id: input.cartId,
        p_quote_id: input.quoteId,
        p_address_id: input.addressId,
        p_customer_note: input.customerNote,
        p_idempotency_key: input.idempotencyKey,
      });
      if (response.error !== null) throw mapRpcError(response.error);
      return parseOrder(response.data);
    } catch (error: unknown) {
      return rethrow(error);
    }
  }
}
