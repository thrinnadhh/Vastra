import {
  MERCHANT_ORDER_STATUSES,
  MerchantOrderError,
  type MerchantOrderAddress,
  type MerchantOrderAlert,
  type MerchantOrderDetail,
  type MerchantOrderDecisionPort,
  type MerchantOrderDecisionResult,
  type MerchantOrderFailureKind,
  type MerchantOrderHistoryEntry,
  type MerchantOrderItem,
  type MerchantOrderPage,
  type MerchantOrderReadPort,
  type MerchantRejectionReason,
  type MerchantOrderShop,
  type MerchantOrderStatus,
  type MerchantOrderSummary,
  type MerchantOrderTotals,
} from './merchant-order.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'COD_PENDING',
  'COD_COLLECTED',
] as const;
const FULFILMENT_TYPES = ['DELIVERY', 'CUSTOMER_PICKUP'] as const;
const ALERT_STATUSES = [
  'PENDING',
  'SENT',
  'DELIVERED',
  'ACKNOWLEDGED',
  'EXPIRED',
  'FAILED',
] as const;
const ACTOR_ROLES = ['SYSTEM', 'CUSTOMER', 'MERCHANT', 'CAPTAIN', 'ADMIN'] as const;

interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

type FetchFunction = (input: string, init: RequestInit) => Promise<HttpResponse>;
type AccessTokenProvider = () => Promise<string | null>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidResponse(): never {
  throw new TypeError('Invalid merchant order response');
}

export function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return isRecord(value) ? value : invalidResponse();
}

export function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : invalidResponse();
}

export function readUuid(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  return UUID_PATTERN.test(value) ? value : invalidResponse();
}

export function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return value === null ? null : typeof value === 'string' ? value : invalidResponse();
}

export function readInteger(record: Record<string, unknown>, key: string, minimum = 0): number {
  const value = record[key];
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
    ? value
    : invalidResponse();
}

export function readDateTime(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  return Number.isFinite(Date.parse(value)) ? value : invalidResponse();
}

export function readNullableDateTime(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : invalidResponse();
}

function readEnum<const T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  values: T,
): T[number] {
  const value = record[key];
  if (typeof value !== 'string') return invalidResponse();
  return values.find((candidate) => candidate === value) ?? invalidResponse();
}

function parseShop(value: unknown): MerchantOrderShop {
  if (!isRecord(value)) invalidResponse();
  return {
    id: readUuid(value, 'id'),
    name: readString(value, 'name'),
    slug: readString(value, 'slug'),
  };
}

function parseTotals(value: unknown): MerchantOrderTotals {
  if (!isRecord(value)) invalidResponse();
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

function parseAlert(value: unknown): MerchantOrderAlert | null {
  if (value === null) return null;
  if (!isRecord(value)) invalidResponse();
  return {
    id: readUuid(value, 'id'),
    status: readEnum(value, 'status', ALERT_STATUSES),
    attemptCount: readInteger(value, 'attemptCount'),
    firstSentAt: readNullableDateTime(value, 'firstSentAt'),
    lastSentAt: readNullableDateTime(value, 'lastSentAt'),
    acknowledgedAt: readNullableDateTime(value, 'acknowledgedAt'),
    expiresAt: readDateTime(value, 'expiresAt'),
    soundName: readString(value, 'soundName'),
    failureReason: readNullableString(value, 'failureReason'),
    createdAt: readDateTime(value, 'createdAt'),
  };
}

function parseSummary(value: unknown): MerchantOrderSummary {
  if (!isRecord(value)) invalidResponse();
  return {
    id: readUuid(value, 'id'),
    orderNumber: readString(value, 'orderNumber'),
    shop: parseShop(value['shop']),
    customerName: readString(value, 'customerName'),
    status: readEnum(value, 'status', MERCHANT_ORDER_STATUSES),
    paymentStatus: readEnum(value, 'paymentStatus', PAYMENT_STATUSES),
    fulfilmentType: readEnum(value, 'fulfilmentType', FULFILMENT_TYPES),
    itemCount: readInteger(value, 'itemCount', 1),
    previewImageObjectKey: readNullableString(value, 'previewImageObjectKey'),
    totals: parseTotals(value['totals']),
    alert: parseAlert(value['alert']),
    estimatedDeliveryAt: readNullableDateTime(value, 'estimatedDeliveryAt'),
    placedAt: readNullableDateTime(value, 'placedAt'),
    createdAt: readDateTime(value, 'createdAt'),
  };
}

function parseAddress(value: unknown): MerchantOrderAddress {
  if (!isRecord(value)) invalidResponse();
  const latitude = value['latitude'];
  const longitude = value['longitude'];
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    invalidResponse();
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
    countryCode: readString(value, 'countryCode'),
    latitude,
    longitude,
  };
}

function parseItem(value: unknown): MerchantOrderItem {
  if (!isRecord(value)) invalidResponse();
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

function parseHistory(value: unknown): MerchantOrderHistoryEntry {
  if (!isRecord(value)) invalidResponse();
  const previous = value['previousStatus'];
  const previousStatus =
    previous === null
      ? null
      : typeof previous === 'string' &&
          MERCHANT_ORDER_STATUSES.some((candidate) => candidate === previous)
        ? (previous as MerchantOrderStatus)
        : invalidResponse();
  return {
    id: readString(value, 'id'),
    previousStatus,
    newStatus: readEnum(value, 'newStatus', MERCHANT_ORDER_STATUSES),
    changedByRole: readEnum(value, 'changedByRole', ACTOR_ROLES),
    reasonCode: readNullableString(value, 'reasonCode'),
    note: readNullableString(value, 'note'),
    createdAt: readDateTime(value, 'createdAt'),
  };
}

function parseDetail(value: unknown): MerchantOrderDetail {
  if (!isRecord(value)) invalidResponse();
  const items = value['items'];
  const history = value['history'];
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    !Array.isArray(history) ||
    history.length === 0
  ) {
    invalidResponse();
  }
  return {
    id: readUuid(value, 'id'),
    orderNumber: readString(value, 'orderNumber'),
    cartId: value['cartId'] === null ? null : readUuid(value, 'cartId'),
    quoteId: value['quoteId'] === null ? null : readUuid(value, 'quoteId'),
    shop: parseShop(value['shop']),
    status: readEnum(value, 'status', MERCHANT_ORDER_STATUSES),
    paymentStatus: readEnum(value, 'paymentStatus', PAYMENT_STATUSES),
    fulfilmentType: readEnum(value, 'fulfilmentType', FULFILMENT_TYPES),
    itemCount: readInteger(value, 'itemCount', 1),
    previewImageObjectKey: null,
    totals: parseTotals(value['totals']),
    alert: parseAlert(value['alert']),
    estimatedDeliveryAt: readNullableDateTime(value, 'estimatedDeliveryAt'),
    placedAt: readNullableDateTime(value, 'placedAt'),
    createdAt: readDateTime(value, 'createdAt'),
    address: parseAddress(value['address']),
    items: items.map(parseItem),
    customerNote: readNullableString(value, 'customerNote'),
    cancellationReasonCode: readNullableString(value, 'cancellationReasonCode'),
    cancellationNote: readNullableString(value, 'cancellationNote'),
    history: history.map(parseHistory),
    acceptedAt: readNullableDateTime(value, 'acceptedAt'),
    readyAt: readNullableDateTime(value, 'readyAt'),
    pickedUpAt: readNullableDateTime(value, 'pickedUpAt'),
    deliveredAt: readNullableDateTime(value, 'deliveredAt'),
    completedAt: readNullableDateTime(value, 'completedAt'),
    cancelledAt: readNullableDateTime(value, 'cancelledAt'),
    updatedAt: readDateTime(value, 'updatedAt'),
  };
}

function readEnvelope(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || value['success'] !== true) invalidResponse();
  return readRecord(value, 'data');
}

export function parseMerchantOrderPage(value: unknown): MerchantOrderPage {
  const data = readEnvelope(value);
  const orders = data['orders'];
  const nextCursor = data['nextCursor'];
  if (!Array.isArray(orders) || (nextCursor !== null && typeof nextCursor !== 'string'))
    invalidResponse();
  return { orders: orders.map(parseSummary), nextCursor };
}

export function parseMerchantOrderDetail(value: unknown): MerchantOrderDetail {
  return parseDetail(readEnvelope(value)['order']);
}

export function parseApiError(
  value: unknown,
): { readonly code: string; readonly retryable: boolean } | null {
  if (!isRecord(value) || value['success'] !== false || !isRecord(value['error'])) return null;
  const code = value['error']['code'];
  const retryable = value['error']['retryable'];
  return typeof code === 'string' && typeof retryable === 'boolean' ? { code, retryable } : null;
}

export function mapMerchantErrorKind(code: string, status: number): MerchantOrderFailureKind {
  if (status === 401 || code === 'AUTH_REQUIRED' || code === 'AUTH_TOKEN_EXPIRED')
    return 'AUTHENTICATION';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'INVALID_STATE';
  if (status === 400) return 'VALIDATION';
  if (status === 503) return 'TEMPORARILY_UNAVAILABLE';
  return 'UNKNOWN';
}

function parseMerchantDecision(value: unknown): MerchantOrderDecisionResult {
  const order = readRecord(readEnvelope(value), 'order');
  const status = readEnum(order, 'status', ['MERCHANT_ACCEPTED', 'CANCELLED'] as const);
  const preparation = order['merchantPreparationMinutes'];
  const replayed = order['replayed'];
  if (
    (preparation !== null &&
      (typeof preparation !== 'number' ||
        !Number.isSafeInteger(preparation) ||
        preparation < 1 ||
        preparation > 240)) ||
    typeof replayed !== 'boolean' ||
    order['alertStatus'] !== 'ACKNOWLEDGED'
  )
    invalidResponse();
  return {
    orderId: readUuid(order, 'orderId'),
    orderNumber: readString(order, 'orderNumber'),
    status,
    alertStatus: 'ACKNOWLEDGED',
    merchantPreparationMinutes: preparation,
    acceptedAt: readNullableDateTime(order, 'acceptedAt'),
    cancelledAt: readNullableDateTime(order, 'cancelledAt'),
    cancellationReasonCode: readNullableString(order, 'cancellationReasonCode'),
    cancellationNote: readNullableString(order, 'cancellationNote'),
    reservationsReleased: readInteger(order, 'reservationsReleased'),
    replayed,
  };
}

export class HttpMerchantOrderClient implements MerchantOrderReadPort, MerchantOrderDecisionPort {
  public constructor(
    protected readonly apiBaseUrl: string,
    protected readonly getAccessToken: AccessTokenProvider,
    protected readonly fetchFunction: FetchFunction = fetch,
  ) {}

  public async listOrders(input: {
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<MerchantOrderPage> {
    const query = new URLSearchParams();
    if (input.cursor !== undefined) query.set('cursor', input.cursor);
    query.set('limit', String(input.limit ?? 20));
    return this.request(
      `/merchant/orders?${query.toString()}`,
      'GET',
      undefined,
      parseMerchantOrderPage,
    );
  }

  public async getOrder(orderId: string): Promise<MerchantOrderDetail> {
    return this.request(
      `/merchant/orders/${encodeURIComponent(orderId)}`,
      'GET',
      undefined,
      parseMerchantOrderDetail,
    );
  }

  public async acceptOrder(
    orderId: string,
    input: { readonly preparationMinutes: number },
  ): Promise<MerchantOrderDecisionResult> {
    return this.request(
      `/merchant/orders/${encodeURIComponent(orderId)}/accept`,
      'POST',
      input,
      parseMerchantDecision,
    );
  }

  public async rejectOrder(
    orderId: string,
    input: {
      readonly reasonCode: MerchantRejectionReason;
      readonly orderItemId: string | null;
      readonly note: string | null;
    },
  ): Promise<MerchantOrderDecisionResult> {
    return this.request(
      `/merchant/orders/${encodeURIComponent(orderId)}/reject`,
      'POST',
      input,
      parseMerchantDecision,
    );
  }

  protected async request<T>(
    path: string,
    method: 'GET' | 'POST',
    body: unknown,
    parse: (value: unknown) => T,
    additionalHeaders: Readonly<Record<string, string>> = {},
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    if (accessToken === null)
      throw new MerchantOrderError('AUTHENTICATION', 'AUTH_REQUIRED', false);

    let response: HttpResponse;
    try {
      response = await this.fetchFunction(`${this.apiBaseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...additionalHeaders,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new MerchantOrderError('TRANSPORT', null, true);
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      throw new MerchantOrderError('MALFORMED_RESPONSE', null, false);
    }

    if (!response.ok) {
      const error = parseApiError(responseBody);
      throw new MerchantOrderError(
        mapMerchantErrorKind(error?.code ?? 'UNKNOWN', response.status),
        error?.code ?? null,
        error?.retryable ?? response.status >= 500,
      );
    }

    try {
      return parse(responseBody);
    } catch {
      throw new MerchantOrderError('MALFORMED_RESPONSE', null, false);
    }
  }
}
