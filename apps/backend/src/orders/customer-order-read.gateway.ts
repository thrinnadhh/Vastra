import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';

import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CustomerOrderAddressSnapshot,
  CustomerOrderItemSnapshot,
  CustomerOrderShopSnapshot,
  CustomerOrderTotalsSnapshot,
} from './customer-order.types';
import {
  CUSTOMER_ORDER_ACTOR_ROLES,
  CUSTOMER_ORDER_FULFILMENT_TYPES,
  CUSTOMER_ORDER_PAYMENT_STATUSES,
  CUSTOMER_ORDER_STATUSES,
  type CustomerOrderActorRole,
  type CustomerOrderDetail,
  type CustomerOrderFulfilmentType,
  type CustomerOrderHistoryEntry,
  type CustomerOrderListPage,
  type CustomerOrderListQuery,
  type CustomerOrderPaymentStatus,
  type CustomerOrderStatus,
  type CustomerOrderSummary,
} from './customer-order-read.types';

const ORDER_LIST_SELECT = [
  'id',
  'order_number',
  'shop_id',
  'status',
  'payment_status',
  'fulfilment_type',
  'subtotal_paise',
  'product_discount_paise',
  'coupon_discount_paise',
  'delivery_fee_paise',
  'platform_fee_paise',
  'tax_paise',
  'total_paise',
  'estimated_delivery_at',
  'placed_at',
  'created_at',
].join(', ');

const ORDER_DETAIL_SELECT = [
  'id',
  'order_number',
  'cart_id',
  'checkout_quote_id',
  'shop_id',
  'address_snapshot',
  'status',
  'payment_status',
  'fulfilment_type',
  'subtotal_paise',
  'product_discount_paise',
  'coupon_discount_paise',
  'delivery_fee_paise',
  'platform_fee_paise',
  'tax_paise',
  'total_paise',
  'estimated_delivery_at',
  'customer_note',
  'cancellation_reason_code',
  'cancellation_note',
  'placed_at',
  'accepted_at',
  'ready_at',
  'picked_up_at',
  'delivered_at',
  'completed_at',
  'cancelled_at',
  'created_at',
  'updated_at',
].join(', ');

const ORDER_ITEM_SELECT = [
  'id',
  'order_id',
  'product_id',
  'variant_id',
  'product_name_snapshot',
  'sku_snapshot',
  'colour_snapshot',
  'size_snapshot',
  'image_object_key_snapshot',
  'quantity',
  'unit_mrp_paise',
  'unit_selling_price_paise',
  'discount_paise',
  'total_paise',
  'created_at',
].join(', ');

const ORDER_HISTORY_SELECT = [
  'id',
  'order_id',
  'previous_status',
  'new_status',
  'changed_by_role',
  'reason_code',
  'note',
  'created_at',
].join(', ');

export interface CustomerOrderReadGateway {
  listCustomerOrders(
    client: SupabaseClient,
    actorId: string,
    query: CustomerOrderListQuery,
  ): Promise<CustomerOrderListPage>;

  getCustomerOrder(
    client: SupabaseClient,
    actorId: string,
    orderId: string,
  ): Promise<CustomerOrderDetail>;
}

export class CustomerOrderReadGatewayUnavailableError extends Error {
  public constructor() {
    super('Customer order read provider unavailable');
    this.name = 'CustomerOrderReadGatewayUnavailableError';
  }
}

export class CustomerOrderReadDataInvalidError extends Error {
  public constructor() {
    super('Customer order read data invalid');
    this.name = 'CustomerOrderReadDataInvalidError';
  }
}

export class CustomerOrderReadNotFoundError extends Error {
  public constructor() {
    super('Customer order not found');
    this.name = 'CustomerOrderReadNotFoundError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new CustomerOrderReadDataInvalidError();
  }

  return value;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerOrderReadDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerOrderReadDataInvalidError();
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
    throw new CustomerOrderReadDataInvalidError();
  }

  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNonNegativeInteger(record, key);

  if (value < 1) {
    throw new CustomerOrderReadDataInvalidError();
  }

  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);

  if (Number.isNaN(Date.parse(value))) {
    throw new CustomerOrderReadDataInvalidError();
  }

  return value;
}

function requireNullableTimestamp(record: Record<string, unknown>, key: string): string | null {
  const value = requireNullableString(record, key);

  if (value !== null && Number.isNaN(Date.parse(value))) {
    throw new CustomerOrderReadDataInvalidError();
  }

  return value;
}

function requireMember<T extends string>(
  record: Record<string, unknown>,
  key: string,
  values: readonly T[],
): T {
  const value = record[key];

  if (typeof value !== 'string' || !values.some((candidate) => candidate === value)) {
    throw new CustomerOrderReadDataInvalidError();
  }

  return value as T;
}

function parseStatus(record: Record<string, unknown>, key: string): CustomerOrderStatus {
  return requireMember(record, key, CUSTOMER_ORDER_STATUSES);
}

function parsePaymentStatus(record: Record<string, unknown>): CustomerOrderPaymentStatus {
  return requireMember(record, 'payment_status', CUSTOMER_ORDER_PAYMENT_STATUSES);
}

function parseFulfilmentType(record: Record<string, unknown>): CustomerOrderFulfilmentType {
  return requireMember(record, 'fulfilment_type', CUSTOMER_ORDER_FULFILMENT_TYPES);
}

function parseActorRole(record: Record<string, unknown>): CustomerOrderActorRole {
  return requireMember(record, 'changed_by_role', CUSTOMER_ORDER_ACTOR_ROLES);
}

function parseShop(value: unknown): CustomerOrderShopSnapshot {
  const record = requireRecord(value);

  return {
    id: requireString(record, 'id'),
    name: requireString(record, 'name'),
    slug: requireString(record, 'slug'),
  };
}

function parseAddress(value: unknown): CustomerOrderAddressSnapshot {
  const record = requireRecord(value);
  const latitude = parseNumeric(record['latitude']);
  const longitude = parseNumeric(record['longitude']);

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new CustomerOrderReadDataInvalidError();
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

function parseTotals(record: Record<string, unknown>): CustomerOrderTotalsSnapshot {
  const totals = {
    subtotalPaise: requireNonNegativeInteger(record, 'subtotal_paise'),
    productDiscountPaise: requireNonNegativeInteger(record, 'product_discount_paise'),
    couponDiscountPaise: requireNonNegativeInteger(record, 'coupon_discount_paise'),
    deliveryFeePaise: requireNonNegativeInteger(record, 'delivery_fee_paise'),
    platformFeePaise: requireNonNegativeInteger(record, 'platform_fee_paise'),
    taxPaise: requireNonNegativeInteger(record, 'tax_paise'),
    totalPaise: requireNonNegativeInteger(record, 'total_paise'),
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
    throw new CustomerOrderReadDataInvalidError();
  }

  return totals;
}

function parseItem(value: unknown): CustomerOrderItemSnapshot & { readonly orderId: string } {
  const record = requireRecord(value);
  const quantity = requirePositiveInteger(record, 'quantity');
  const unitMrpPaise = requireNonNegativeInteger(record, 'unit_mrp_paise');
  const unitSellingPricePaise = requireNonNegativeInteger(record, 'unit_selling_price_paise');
  const discountPaise = requireNonNegativeInteger(record, 'discount_paise');
  const totalPaise = requireNonNegativeInteger(record, 'total_paise');

  if (
    unitSellingPricePaise > unitMrpPaise ||
    discountPaise > quantity * unitSellingPricePaise ||
    totalPaise !== quantity * unitSellingPricePaise - discountPaise
  ) {
    throw new CustomerOrderReadDataInvalidError();
  }

  return {
    orderId: requireString(record, 'order_id'),
    id: requireString(record, 'id'),
    productId: requireString(record, 'product_id'),
    variantId: requireString(record, 'variant_id'),
    productName: requireString(record, 'product_name_snapshot'),
    sku: requireString(record, 'sku_snapshot'),
    colourName: requireNullableString(record, 'colour_snapshot'),
    sizeLabel: requireNullableString(record, 'size_snapshot'),
    imageObjectKey: requireNullableString(record, 'image_object_key_snapshot'),
    quantity,
    unitMrpPaise,
    unitSellingPricePaise,
    discountPaise,
    totalPaise,
  };
}

function parseHistory(value: unknown): CustomerOrderHistoryEntry {
  const record = requireRecord(value);
  const previousStatusValue = record['previous_status'];

  let previousStatus: CustomerOrderStatus | null;

  if (previousStatusValue === null) {
    previousStatus = null;
  } else {
    previousStatus = parseStatus(record, 'previous_status');
  }

  const idValue = parseNumeric(record['id']);

  if (!Number.isSafeInteger(idValue) || idValue < 1) {
    throw new CustomerOrderReadDataInvalidError();
  }

  return {
    id: String(idValue),
    previousStatus,
    newStatus: parseStatus(record, 'new_status'),
    changedByRole: parseActorRole(record),
    reasonCode: requireNullableString(record, 'reason_code'),
    note: requireNullableString(record, 'note'),
    createdAt: requireTimestamp(record, 'created_at'),
  };
}

function rethrowReadError(error: unknown): never {
  if (
    error instanceof CustomerOrderReadGatewayUnavailableError ||
    error instanceof CustomerOrderReadDataInvalidError ||
    error instanceof CustomerOrderReadNotFoundError
  ) {
    throw error;
  }

  throw new CustomerOrderReadGatewayUnavailableError();
}

@Injectable()
export class SupabaseCustomerOrderReadGateway implements CustomerOrderReadGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async listCustomerOrders(
    client: SupabaseClient,
    actorId: string,
    query: CustomerOrderListQuery,
  ): Promise<CustomerOrderListPage> {
    try {
      const orderResult = await client
        .from('orders')
        .select(ORDER_LIST_SELECT)
        .eq('customer_id', actorId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(query.offset, query.offset + query.limit);

      if (orderResult.error !== null) {
        throw new CustomerOrderReadGatewayUnavailableError();
      }

      const rawOrders = orderResult.data;
      const hasMore = rawOrders.length > query.limit;
      const visibleOrders = rawOrders.slice(0, query.limit);

      if (visibleOrders.length === 0) {
        return {
          orders: [],
          nextOffset: null,
        };
      }

      const orderRecords = visibleOrders.map((value) => requireRecord(value));
      const orderIds = orderRecords.map((record) => requireString(record, 'id'));
      const shopIds = [...new Set(orderRecords.map((record) => requireString(record, 'shop_id')))];

      const [shopResult, itemResult] = await Promise.all([
        this.trustedClient.from('shops').select('id, name, slug').in('id', shopIds),
        client
          .from('order_items')
          .select(ORDER_ITEM_SELECT)
          .in('order_id', orderIds)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
      ]);

      if (shopResult.error !== null || itemResult.error !== null) {
        throw new CustomerOrderReadGatewayUnavailableError();
      }

      const shops = new Map(
        shopResult.data.map((value) => {
          const shop = parseShop(value);
          return [shop.id, shop] as const;
        }),
      );

      const itemStats = new Map<
        string,
        {
          itemCount: number;
          previewImageObjectKey: string | null;
        }
      >();

      for (const value of itemResult.data) {
        const item = parseItem(value);
        const previous = itemStats.get(item.orderId) ?? {
          itemCount: 0,
          previewImageObjectKey: null,
        };

        itemStats.set(item.orderId, {
          itemCount: previous.itemCount + item.quantity,
          previewImageObjectKey: previous.previewImageObjectKey ?? item.imageObjectKey,
        });
      }

      const orders: CustomerOrderSummary[] = orderRecords.map((record) => {
        const id = requireString(record, 'id');
        const shopId = requireString(record, 'shop_id');
        const shop = shops.get(shopId);
        const stats = itemStats.get(id);

        if (shop === undefined || stats === undefined || stats.itemCount < 1) {
          throw new CustomerOrderReadDataInvalidError();
        }

        return {
          id,
          orderNumber: requireString(record, 'order_number'),
          shop,
          status: parseStatus(record, 'status'),
          paymentStatus: parsePaymentStatus(record),
          fulfilmentType: parseFulfilmentType(record),
          itemCount: stats.itemCount,
          previewImageObjectKey: stats.previewImageObjectKey,
          totals: parseTotals(record),
          estimatedDeliveryAt: requireNullableTimestamp(record, 'estimated_delivery_at'),
          placedAt: requireNullableTimestamp(record, 'placed_at'),
          createdAt: requireTimestamp(record, 'created_at'),
        };
      });

      return {
        orders,
        nextOffset: hasMore ? query.offset + query.limit : null,
      };
    } catch (error: unknown) {
      return rethrowReadError(error);
    }
  }

  public async getCustomerOrder(
    client: SupabaseClient,
    actorId: string,
    orderId: string,
  ): Promise<CustomerOrderDetail> {
    try {
      const orderResult = await client
        .from('orders')
        .select(ORDER_DETAIL_SELECT)
        .eq('id', orderId)
        .eq('customer_id', actorId)
        .maybeSingle();

      if (orderResult.error !== null) {
        throw new CustomerOrderReadGatewayUnavailableError();
      }

      if (orderResult.data === null) {
        throw new CustomerOrderReadNotFoundError();
      }

      const orderRecord = requireRecord(orderResult.data);
      const shopId = requireString(orderRecord, 'shop_id');

      const [shopResult, itemResult, historyResult] = await Promise.all([
        this.trustedClient.from('shops').select('id, name, slug').eq('id', shopId).maybeSingle(),
        client
          .from('order_items')
          .select(ORDER_ITEM_SELECT)
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
        client
          .from('order_status_history')
          .select(ORDER_HISTORY_SELECT)
          .eq('order_id', orderId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
      ]);

      if (shopResult.error !== null || itemResult.error !== null || historyResult.error !== null) {
        throw new CustomerOrderReadGatewayUnavailableError();
      }

      const items = itemResult.data.map((value) => {
        const { orderId: itemOrderId, ...item } = parseItem(value);

        if (itemOrderId !== orderId) {
          throw new CustomerOrderReadDataInvalidError();
        }

        return item;
      });

      const history = historyResult.data.map((value) => parseHistory(value));

      if (items.length === 0 || history.length === 0) {
        throw new CustomerOrderReadDataInvalidError();
      }

      const totals = parseTotals(orderRecord);
      const itemSubtotal = items.reduce((sum, item) => sum + item.totalPaise, 0);

      if (totals.subtotalPaise !== itemSubtotal) {
        throw new CustomerOrderReadDataInvalidError();
      }

      return {
        id: requireString(orderRecord, 'id'),
        orderNumber: requireString(orderRecord, 'order_number'),
        cartId: requireNullableString(orderRecord, 'cart_id'),
        quoteId: requireNullableString(orderRecord, 'checkout_quote_id'),
        shop: parseShop(shopResult.data),
        address: parseAddress(orderRecord['address_snapshot']),
        status: parseStatus(orderRecord, 'status'),
        paymentStatus: parsePaymentStatus(orderRecord),
        fulfilmentType: parseFulfilmentType(orderRecord),
        items,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        totals,
        estimatedDeliveryAt: requireNullableTimestamp(orderRecord, 'estimated_delivery_at'),
        customerNote: requireNullableString(orderRecord, 'customer_note'),
        cancellationReasonCode: requireNullableString(orderRecord, 'cancellation_reason_code'),
        cancellationNote: requireNullableString(orderRecord, 'cancellation_note'),
        history,
        placedAt: requireNullableTimestamp(orderRecord, 'placed_at'),
        acceptedAt: requireNullableTimestamp(orderRecord, 'accepted_at'),
        readyAt: requireNullableTimestamp(orderRecord, 'ready_at'),
        pickedUpAt: requireNullableTimestamp(orderRecord, 'picked_up_at'),
        deliveredAt: requireNullableTimestamp(orderRecord, 'delivered_at'),
        completedAt: requireNullableTimestamp(orderRecord, 'completed_at'),
        cancelledAt: requireNullableTimestamp(orderRecord, 'cancelled_at'),
        createdAt: requireTimestamp(orderRecord, 'created_at'),
        updatedAt: requireTimestamp(orderRecord, 'updated_at'),
      };
    } catch (error: unknown) {
      return rethrowReadError(error);
    }
  }
}
