import {
  CUSTOMER_ORDER_STATUSES,
  type CustomerOrderAddress,
  type CustomerOrderFailureKind,
  type CustomerOrderFulfilmentType,
  type CustomerOrderDetail,
  type CustomerOrderHistoryEntry,
  type CustomerOrderItem,
  type CustomerOrderPaymentStatus,
  type CustomerOrderShop,
  type CustomerOrderStatus,
  type CustomerOrderSummary,
  type CustomerOrderTotals,
  type CustomerOrdersPage,
  type PlacedCustomerCodOrder,
} from './customer-order.types';

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) {
    throw new TypeError('Invalid customer order response');
  }
  return value;
}

export function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('Invalid customer order response');
  }
  return value;
}

export function readUuid(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (!UUID_PATTERN.test(value)) {
    throw new TypeError('Invalid customer order response');
  }
  return value;
}

function readNullableUuid(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new TypeError('Invalid customer order response');
  }
  return value;
}

export function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new TypeError('Invalid customer order response');
  }
  return value;
}

export function readInteger(record: Record<string, unknown>, key: string, minimum = 0): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError('Invalid customer order response');
  }
  return value;
}

export function readDateTime(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (!Number.isFinite(Date.parse(value))) {
    throw new TypeError('Invalid customer order response');
  }
  return value;
}

export function readNullableDateTime(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new TypeError('Invalid customer order response');
  }
  return value;
}

export function readStatus(record: Record<string, unknown>, key: string): CustomerOrderStatus {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('Invalid customer order response');
  }
  return CUSTOMER_ORDER_STATUSES.some((status) => status === value)
    ? (value as CustomerOrderStatus)
    : 'UNKNOWN';
}

const PAYMENT_STATUSES: readonly CustomerOrderPaymentStatus[] = [
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'COD_PENDING',
  'COD_COLLECTED',
];

function readPaymentStatus(
  record: Record<string, unknown>,
  key: string,
): CustomerOrderPaymentStatus {
  const value = record[key];
  if (!PAYMENT_STATUSES.some((status) => status === value)) {
    throw new TypeError('Invalid customer order response');
  }
  return value as CustomerOrderPaymentStatus;
}

function readFulfilmentType(
  record: Record<string, unknown>,
  key: string,
): CustomerOrderFulfilmentType {
  const value = record[key];
  if (value !== 'DELIVERY' && value !== 'CUSTOMER_PICKUP') {
    throw new TypeError('Invalid customer order response');
  }
  return value;
}

export function parseOrderAddress(value: unknown): CustomerOrderAddress {
  if (!isRecord(value)) {
    throw new TypeError('Invalid customer order response');
  }
  const latitude = value['latitude'];
  const longitude = value['longitude'];
  const countryCode = readString(value, 'countryCode');
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !/^[A-Z]{2}$/u.test(countryCode)
  ) {
    throw new TypeError('Invalid customer order response');
  }
  return {
    id: readUuid(value, 'id'),
    label: readNullableString(value, 'label'),
    recipientName: readString(value, 'recipientName'),
    phoneNumber: readString(value, 'phoneNumber'),
    line1: readString(value, 'line1'),
    line2: readNullableString(value, 'line2'),
    landmark: readNullableString(value, 'landmark'),
    area: readString(value, 'area'),
    city: readString(value, 'city'),
    state: readString(value, 'state'),
    postalCode: readString(value, 'postalCode'),
    countryCode,
    latitude,
    longitude,
  };
}

export function parseOrderShop(value: unknown): CustomerOrderShop {
  if (!isRecord(value)) {
    throw new TypeError('Invalid customer order response');
  }
  return {
    id: readUuid(value, 'id'),
    name: readString(value, 'name'),
    slug: readString(value, 'slug'),
  };
}

export function parseOrderItem(value: unknown): CustomerOrderItem {
  if (!isRecord(value)) {
    throw new TypeError('Invalid customer order response');
  }
  return {
    id: readUuid(value, 'id'),
    productId: readUuid(value, 'productId'),
    variantId: readUuid(value, 'variantId'),
    productName: readString(value, 'productName'),
    sku: readString(value, 'sku'),
    colourName: readNullableString(value, 'colourName'),
    sizeLabel: readNullableString(value, 'sizeLabel'),
    imageObjectKey: readNullableString(value, 'imageObjectKey'),
    quantity: readInteger(value, 'quantity', 1),
    unitMrpPaise: readInteger(value, 'unitMrpPaise'),
    unitSellingPricePaise: readInteger(value, 'unitSellingPricePaise'),
    discountPaise: readInteger(value, 'discountPaise'),
    totalPaise: readInteger(value, 'totalPaise'),
  };
}

export function parseOrderTotals(value: unknown): CustomerOrderTotals {
  if (!isRecord(value)) {
    throw new TypeError('Invalid customer order response');
  }
  return {
    subtotalPaise: readInteger(value, 'subtotalPaise'),
    productDiscountPaise: readInteger(value, 'productDiscountPaise'),
    couponDiscountPaise: readInteger(value, 'couponDiscountPaise'),
    deliveryFeePaise: readInteger(value, 'deliveryFeePaise'),
    platformFeePaise: readInteger(value, 'platformFeePaise'),
    taxPaise: readInteger(value, 'taxPaise'),
    totalPaise: readInteger(value, 'totalPaise'),
  };
}

function readLiteral<T extends string>(
  record: Record<string, unknown>,
  key: string,
  expected: T,
): T {
  if (record[key] !== expected) {
    throw new TypeError('Invalid customer order response');
  }
  return expected;
}

export function parsePlacedCustomerCodOrderEnvelope(value: unknown): PlacedCustomerCodOrder {
  if (!isRecord(value) || value['success'] !== true) {
    throw new TypeError('Invalid customer order response');
  }
  const data = readRecord(value, 'data');
  const order = readRecord(data, 'order');
  const items = order['items'];
  if (!Array.isArray(items) || items.length === 0 || typeof order['replayed'] !== 'boolean') {
    throw new TypeError('Invalid customer order response');
  }

  return {
    id: readUuid(order, 'id'),
    orderNumber: readString(order, 'orderNumber'),
    cartId: readUuid(order, 'cartId'),
    quoteId: readUuid(order, 'quoteId'),
    shop: parseOrderShop(order['shop']),
    address: parseOrderAddress(order['address']),
    status: readLiteral(order, 'status', 'WAITING_FOR_MERCHANT'),
    paymentStatus: readLiteral(order, 'paymentStatus', 'COD_PENDING'),
    paymentMethod: readLiteral(order, 'paymentMethod', 'COD'),
    fulfilmentType: readLiteral(order, 'fulfilmentType', 'DELIVERY'),
    items: items.map(parseOrderItem),
    totals: parseOrderTotals(order['totals']),
    estimatedDeliveryAt: readDateTime(order, 'estimatedDeliveryAt'),
    customerNote: readNullableString(order, 'customerNote'),
    placedAt: readDateTime(order, 'placedAt'),
    replayed: order['replayed'],
  };
}

export function parseCustomerOrderSummary(value: unknown): CustomerOrderSummary {
  if (!isRecord(value)) {
    throw new TypeError('Invalid customer order response');
  }
  return {
    id: readUuid(value, 'id'),
    orderNumber: readString(value, 'orderNumber'),
    shop: parseOrderShop(value['shop']),
    status: readStatus(value, 'status'),
    paymentStatus: readPaymentStatus(value, 'paymentStatus'),
    fulfilmentType: readFulfilmentType(value, 'fulfilmentType'),
    itemCount: readInteger(value, 'itemCount', 1),
    previewImageObjectKey: readNullableString(value, 'previewImageObjectKey'),
    totals: parseOrderTotals(value['totals']),
    estimatedDeliveryAt: readNullableDateTime(value, 'estimatedDeliveryAt'),
    placedAt: readNullableDateTime(value, 'placedAt'),
    createdAt: readDateTime(value, 'createdAt'),
  };
}

export function parseCustomerOrdersPageEnvelope(value: unknown): CustomerOrdersPage {
  if (!isRecord(value) || value['success'] !== true) {
    throw new TypeError('Invalid customer order response');
  }
  const data = readRecord(value, 'data');
  const orders = data['orders'];
  const nextCursor = data['nextCursor'];
  if (!Array.isArray(orders) || (nextCursor !== null && typeof nextCursor !== 'string')) {
    throw new TypeError('Invalid customer order response');
  }
  return {
    orders: orders.map(parseCustomerOrderSummary),
    nextCursor,
  };
}

function parseCustomerOrderHistoryEntry(value: unknown): CustomerOrderHistoryEntry {
  if (!isRecord(value)) {
    throw new TypeError('Invalid customer order response');
  }
  const id = readString(value, 'id');
  if (!/^[1-9][0-9]*$/u.test(id)) {
    throw new TypeError('Invalid customer order response');
  }
  return {
    id,
    status: readStatus(value, 'newStatus'),
    createdAt: readDateTime(value, 'createdAt'),
  };
}

function parseCustomerOrderDetail(value: unknown): CustomerOrderDetail {
  if (!isRecord(value)) {
    throw new TypeError('Invalid customer order response');
  }
  const items = value['items'];
  const history = value['history'];
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    !Array.isArray(history) ||
    history.length === 0
  ) {
    throw new TypeError('Invalid customer order response');
  }
  return {
    id: readUuid(value, 'id'),
    orderNumber: readString(value, 'orderNumber'),
    cartId: readNullableUuid(value, 'cartId'),
    quoteId: readNullableUuid(value, 'quoteId'),
    shop: parseOrderShop(value['shop']),
    address: parseOrderAddress(value['address']),
    status: readStatus(value, 'status'),
    paymentStatus: readPaymentStatus(value, 'paymentStatus'),
    fulfilmentType: readFulfilmentType(value, 'fulfilmentType'),
    items: items.map(parseOrderItem),
    itemCount: readInteger(value, 'itemCount', 1),
    totals: parseOrderTotals(value['totals']),
    estimatedDeliveryAt: readNullableDateTime(value, 'estimatedDeliveryAt'),
    customerNote: readNullableString(value, 'customerNote'),
    history: history.map(parseCustomerOrderHistoryEntry),
    placedAt: readNullableDateTime(value, 'placedAt'),
    acceptedAt: readNullableDateTime(value, 'acceptedAt'),
    readyAt: readNullableDateTime(value, 'readyAt'),
    pickedUpAt: readNullableDateTime(value, 'pickedUpAt'),
    deliveredAt: readNullableDateTime(value, 'deliveredAt'),
    completedAt: readNullableDateTime(value, 'completedAt'),
    cancelledAt: readNullableDateTime(value, 'cancelledAt'),
    createdAt: readDateTime(value, 'createdAt'),
    updatedAt: readDateTime(value, 'updatedAt'),
  };
}

export function parseCustomerOrderDetailEnvelope(value: unknown): CustomerOrderDetail {
  if (!isRecord(value) || value['success'] !== true) {
    throw new TypeError('Invalid customer order response');
  }
  const data = readRecord(value, 'data');
  return parseCustomerOrderDetail(data['order']);
}

export function parseApiError(value: unknown): { code: string; retryable: boolean } | null {
  if (!isRecord(value) || value['success'] !== false || !isRecord(value['error'])) {
    return null;
  }
  const code = value['error']['code'];
  const retryable = value['error']['retryable'];
  if (typeof code !== 'string' || typeof retryable !== 'boolean') {
    return null;
  }
  return { code, retryable };
}

export function mapOrderErrorKind(code: string, status: number): CustomerOrderFailureKind {
  if (code === 'AUTH_REQUIRED' || code === 'AUTH_TOKEN_EXPIRED' || status === 401) {
    return 'AUTHENTICATION';
  }
  if (status === 403) {
    return 'FORBIDDEN';
  }
  if (
    code === 'CHECKOUT_QUOTE_EXPIRED' ||
    code === 'CHECKOUT_QUOTE_NOT_FOUND' ||
    code === 'CHECKOUT_QUOTE_MISMATCH' ||
    code === 'CART_PRICE_CHANGED' ||
    code === 'INSUFFICIENT_INVENTORY' ||
    code === 'INSUFFICIENT_STOCK'
  ) {
    return 'STALE_QUOTE';
  }
  if (status === 404) {
    return 'NOT_FOUND';
  }
  if (code === 'EXTERNAL_SERVICE_UNAVAILABLE' || status === 503) {
    return 'TEMPORARILY_UNAVAILABLE';
  }
  if (status === 400 || code === 'VALIDATION_ERROR') {
    return 'VALIDATION';
  }
  if (status === 409) {
    return 'CONFLICT';
  }
  return 'UNKNOWN';
}
