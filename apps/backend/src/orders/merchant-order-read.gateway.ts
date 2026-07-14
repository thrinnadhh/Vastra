import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

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
  type CustomerOrderFulfilmentType,
  type CustomerOrderHistoryEntry,
  type CustomerOrderPaymentStatus,
  type CustomerOrderStatus,
} from './customer-order-read.types';
import {
  MERCHANT_ORDER_ALERT_STATUSES,
  type MerchantOrderAlertSnapshot,
  type MerchantOrderAlertStatus,
  type MerchantOrderDetail,
  type MerchantOrderListPage,
  type MerchantOrderListQuery,
  type MerchantOrderSummary,
} from './merchant-order-read.types';

const SHOP_SELECT = ['id', 'name', 'slug'].join(', ');

const ORDER_LIST_SELECT = [
  'id',
  'order_number',
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

const ALERT_SELECT = [
  'id',
  'order_id',
  'alert_status',
  'attempt_count',
  'first_sent_at',
  'last_sent_at',
  'acknowledged_at',
  'expires_at',
  'sound_name',
  'failure_reason',
  'created_at',
].join(', ');

export interface MerchantOrderReadGateway {
  listMerchantOrders(
    client: SupabaseClient,
    merchantId: string,
    query: MerchantOrderListQuery,
  ): Promise<MerchantOrderListPage>;

  getMerchantOrder(
    client: SupabaseClient,
    merchantId: string,
    orderId: string,
  ): Promise<MerchantOrderDetail>;
}

export class MerchantOrderReadGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant order read provider unavailable');
    this.name = 'MerchantOrderReadGatewayUnavailableError';
  }
}

export class MerchantOrderReadDataInvalidError extends Error {
  public constructor() {
    super('Merchant order read data invalid');
    this.name = 'MerchantOrderReadDataInvalidError';
  }
}

export class MerchantOrderReadNotFoundError extends Error {
  public constructor() {
    super('Merchant order not found');
    this.name = 'MerchantOrderReadNotFoundError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new MerchantOrderReadDataInvalidError();
  }

  return value;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerchantOrderReadDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MerchantOrderReadDataInvalidError();
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
    throw new MerchantOrderReadDataInvalidError();
  }

  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNonNegativeInteger(record, key);

  if (value < 1) {
    throw new MerchantOrderReadDataInvalidError();
  }

  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);

  if (Number.isNaN(Date.parse(value))) {
    throw new MerchantOrderReadDataInvalidError();
  }

  return value;
}

function requireNullableTimestamp(record: Record<string, unknown>, key: string): string | null {
  const value = requireNullableString(record, key);

  if (value !== null && Number.isNaN(Date.parse(value))) {
    throw new MerchantOrderReadDataInvalidError();
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
    throw new MerchantOrderReadDataInvalidError();
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

function parseAlertStatus(record: Record<string, unknown>): MerchantOrderAlertStatus {
  return requireMember(record, 'alert_status', MERCHANT_ORDER_ALERT_STATUSES);
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
    throw new MerchantOrderReadDataInvalidError();
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
    throw new MerchantOrderReadDataInvalidError();
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
    throw new MerchantOrderReadDataInvalidError();
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
  const previousStatus =
    previousStatusValue === null ? null : parseStatus(record, 'previous_status');
  const idValue = parseNumeric(record['id']);

  if (!Number.isSafeInteger(idValue) || idValue < 1) {
    throw new MerchantOrderReadDataInvalidError();
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

function parseAlert(value: unknown): MerchantOrderAlertSnapshot & { readonly orderId: string } {
  const record = requireRecord(value);
  const createdAt = requireTimestamp(record, 'created_at');
  const expiresAt = requireTimestamp(record, 'expires_at');

  if (Date.parse(expiresAt) <= Date.parse(createdAt)) {
    throw new MerchantOrderReadDataInvalidError();
  }

  return {
    orderId: requireString(record, 'order_id'),
    id: requireString(record, 'id'),
    status: parseAlertStatus(record),
    attemptCount: requireNonNegativeInteger(record, 'attempt_count'),
    firstSentAt: requireNullableTimestamp(record, 'first_sent_at'),
    lastSentAt: requireNullableTimestamp(record, 'last_sent_at'),
    acknowledgedAt: requireNullableTimestamp(record, 'acknowledged_at'),
    expiresAt,
    soundName: requireString(record, 'sound_name'),
    failureReason: requireNullableString(record, 'failure_reason'),
    createdAt,
  };
}

async function resolveOwnedShop(
  client: SupabaseClient,
  merchantId: string,
): Promise<CustomerOrderShopSnapshot> {
  const result = await client
    .from('shops')
    .select(SHOP_SELECT)
    .eq('merchant_id', merchantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(2);

  if (result.error !== null) {
    throw new MerchantOrderReadGatewayUnavailableError();
  }

  if (result.data.length !== 1) {
    throw new MerchantOrderReadDataInvalidError();
  }

  return parseShop(result.data[0]);
}

function rethrowReadError(error: unknown): never {
  if (
    error instanceof MerchantOrderReadGatewayUnavailableError ||
    error instanceof MerchantOrderReadDataInvalidError ||
    error instanceof MerchantOrderReadNotFoundError
  ) {
    throw error;
  }

  throw new MerchantOrderReadGatewayUnavailableError();
}

@Injectable()
export class SupabaseMerchantOrderReadGateway implements MerchantOrderReadGateway {
  public async listMerchantOrders(
    client: SupabaseClient,
    merchantId: string,
    query: MerchantOrderListQuery,
  ): Promise<MerchantOrderListPage> {
    try {
      const shop = await resolveOwnedShop(client, merchantId);
      const orderResult = await client
        .from('orders')
        .select(ORDER_LIST_SELECT)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(query.offset, query.offset + query.limit);

      if (orderResult.error !== null) {
        throw new MerchantOrderReadGatewayUnavailableError();
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

      const [itemResult, alertResult] = await Promise.all([
        client
          .from('order_items')
          .select(ORDER_ITEM_SELECT)
          .in('order_id', orderIds)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true }),
        client.from('merchant_order_alerts').select(ALERT_SELECT).in('order_id', orderIds),
      ]);

      if (itemResult.error !== null || alertResult.error !== null) {
        throw new MerchantOrderReadGatewayUnavailableError();
      }

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

      const alerts = new Map<string, MerchantOrderAlertSnapshot>();

      for (const value of alertResult.data) {
        const { orderId, ...alert } = parseAlert(value);

        if (alerts.has(orderId)) {
          throw new MerchantOrderReadDataInvalidError();
        }

        alerts.set(orderId, alert);
      }

      const orders: MerchantOrderSummary[] = orderRecords.map((record) => {
        const id = requireString(record, 'id');
        const stats = itemStats.get(id);
        const address = parseAddress(record['address_snapshot']);
        const status = parseStatus(record, 'status');
        const alert = alerts.get(id) ?? null;

        if (
          stats === undefined ||
          stats.itemCount < 1 ||
          (status === 'WAITING_FOR_MERCHANT' && alert === null)
        ) {
          throw new MerchantOrderReadDataInvalidError();
        }

        return {
          id,
          orderNumber: requireString(record, 'order_number'),
          shop,
          customerName: address.recipientName,
          status,
          paymentStatus: parsePaymentStatus(record),
          fulfilmentType: parseFulfilmentType(record),
          itemCount: stats.itemCount,
          previewImageObjectKey: stats.previewImageObjectKey,
          totals: parseTotals(record),
          alert,
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

  public async getMerchantOrder(
    client: SupabaseClient,
    merchantId: string,
    orderId: string,
  ): Promise<MerchantOrderDetail> {
    try {
      const shop = await resolveOwnedShop(client, merchantId);
      const orderResult = await client
        .from('orders')
        .select(ORDER_DETAIL_SELECT)
        .eq('id', orderId)
        .eq('shop_id', shop.id)
        .maybeSingle();

      if (orderResult.error !== null) {
        throw new MerchantOrderReadGatewayUnavailableError();
      }

      if (orderResult.data === null) {
        throw new MerchantOrderReadNotFoundError();
      }

      const orderRecord = requireRecord(orderResult.data);

      const [itemResult, historyResult, alertResult] = await Promise.all([
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
        client
          .from('merchant_order_alerts')
          .select(ALERT_SELECT)
          .eq('order_id', orderId)
          .maybeSingle(),
      ]);

      if (itemResult.error !== null || historyResult.error !== null || alertResult.error !== null) {
        throw new MerchantOrderReadGatewayUnavailableError();
      }

      const items = itemResult.data.map((value) => {
        const { orderId: itemOrderId, ...item } = parseItem(value);

        if (itemOrderId !== orderId) {
          throw new MerchantOrderReadDataInvalidError();
        }

        return item;
      });
      const history = historyResult.data.map((value) => parseHistory(value));
      let alert: MerchantOrderAlertSnapshot | null = null;

      if (alertResult.data !== null) {
        const { orderId: alertOrderId, ...parsedAlert } = parseAlert(alertResult.data);

        if (alertOrderId !== orderId) {
          throw new MerchantOrderReadDataInvalidError();
        }

        alert = parsedAlert;
      }

      if (items.length === 0 || history.length === 0) {
        throw new MerchantOrderReadDataInvalidError();
      }

      const status = parseStatus(orderRecord, 'status');

      if (status === 'WAITING_FOR_MERCHANT' && alert === null) {
        throw new MerchantOrderReadDataInvalidError();
      }

      const totals = parseTotals(orderRecord);
      const itemSubtotal = items.reduce((sum, item) => sum + item.totalPaise, 0);

      if (totals.subtotalPaise !== itemSubtotal) {
        throw new MerchantOrderReadDataInvalidError();
      }

      return {
        id: requireString(orderRecord, 'id'),
        orderNumber: requireString(orderRecord, 'order_number'),
        cartId: requireNullableString(orderRecord, 'cart_id'),
        quoteId: requireNullableString(orderRecord, 'checkout_quote_id'),
        shop,
        address: parseAddress(orderRecord['address_snapshot']),
        status,
        paymentStatus: parsePaymentStatus(orderRecord),
        fulfilmentType: parseFulfilmentType(orderRecord),
        items,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        totals,
        alert,
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
