import {
  CustomerCheckoutQuoteError,
  type CreateCustomerCheckoutQuoteInput,
  type CustomerCheckoutQuote,
  type CustomerCheckoutQuoteAddress,
  type CustomerCheckoutQuoteFailureKind,
  type CustomerCheckoutQuoteItem,
  type CustomerCheckoutQuotePort,
  type CustomerCheckoutQuoteShop,
  type CustomerCheckoutQuoteTotals,
} from './customer-checkout-quote.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

type FetchFunction = (input: string, init: RequestInit) => Promise<HttpResponse>;
type AccessTokenProvider = () => Promise<string | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) {
    throw new TypeError('Invalid checkout quote response');
  }
  return value;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('Invalid checkout quote response');
  }
  return value;
}

function readUuid(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (!UUID_PATTERN.test(value)) {
    throw new TypeError('Invalid checkout quote response');
  }
  return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new TypeError('Invalid checkout quote response');
  }
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new TypeError('Invalid checkout quote response');
  }
  return value;
}

function readInteger(
  record: Record<string, unknown>,
  key: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const value = record[key];
  if (
    !Number.isSafeInteger(value) ||
    typeof value !== 'number' ||
    value < minimum ||
    value > maximum
  ) {
    throw new TypeError('Invalid checkout quote response');
  }
  return value;
}

function readCountryCode(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (!/^[A-Z]{2}$/u.test(value)) {
    throw new TypeError('Invalid checkout quote response');
  }
  return value;
}

function readCoordinate(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TypeError('Invalid checkout quote response');
  }
  return value;
}

function readDateTime(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (!Number.isFinite(Date.parse(value))) {
    throw new TypeError('Invalid checkout quote response');
  }
  return value;
}

function parseAddress(value: unknown): CustomerCheckoutQuoteAddress {
  if (!isRecord(value)) {
    throw new TypeError('Invalid checkout quote response');
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
    countryCode: readCountryCode(value, 'countryCode'),
    latitude: readCoordinate(value, 'latitude', -90, 90),
    longitude: readCoordinate(value, 'longitude', -180, 180),
  };
}

function parseShop(value: unknown): CustomerCheckoutQuoteShop {
  if (!isRecord(value)) {
    throw new TypeError('Invalid checkout quote response');
  }
  return {
    id: readUuid(value, 'id'),
    name: readString(value, 'name'),
    slug: readString(value, 'slug'),
    minimumOrderPaise: readInteger(value, 'minimumOrderPaise'),
    averagePreparationMinutes: readInteger(value, 'averagePreparationMinutes'),
    distanceMeters: readInteger(value, 'distanceMeters'),
    serviceRadiusMeters: readInteger(value, 'serviceRadiusMeters', 1),
  };
}

function parseItem(value: unknown): CustomerCheckoutQuoteItem {
  if (!isRecord(value)) {
    throw new TypeError('Invalid checkout quote response');
  }
  return {
    cartItemId: readUuid(value, 'cartItemId'),
    variantId: readUuid(value, 'variantId'),
    productId: readUuid(value, 'productId'),
    productName: readString(value, 'productName'),
    sku: readString(value, 'sku'),
    colourName: readNullableString(value, 'colourName'),
    sizeLabel: readNullableString(value, 'sizeLabel'),
    quantity: readInteger(value, 'quantity', 1, 20),
    previousUnitPricePaise: readInteger(value, 'previousUnitPricePaise'),
    unitPricePaise: readInteger(value, 'unitPricePaise'),
    priceChanged: readBoolean(value, 'priceChanged'),
    availableQuantity: readInteger(value, 'availableQuantity'),
    inventoryVersion: readInteger(value, 'inventoryVersion', 1),
    lineTotalPaise: readInteger(value, 'lineTotalPaise'),
  };
}

function parseTotals(value: unknown): CustomerCheckoutQuoteTotals {
  if (!isRecord(value)) {
    throw new TypeError('Invalid checkout quote response');
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

export function parseCustomerCheckoutQuoteEnvelope(value: unknown): CustomerCheckoutQuote {
  if (!isRecord(value) || value['success'] !== true) {
    throw new TypeError('Invalid checkout quote response');
  }
  const data = readRecord(value, 'data');
  const quote = readRecord(data, 'quote');
  const items = quote['items'];
  const meta = readRecord(value, 'meta');
  const requestId = meta['requestId'];

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    (requestId !== null && (typeof requestId !== 'string' || !UUID_PATTERN.test(requestId)))
  ) {
    throw new TypeError('Invalid checkout quote response');
  }

  return {
    id: readUuid(quote, 'id'),
    cartId: readUuid(quote, 'cartId'),
    address: parseAddress(quote['address']),
    shop: parseShop(quote['shop']),
    items: items.map(parseItem),
    totals: parseTotals(quote['totals']),
    estimatedPreparationMinutes: readInteger(quote, 'estimatedPreparationMinutes'),
    estimatedTravelMinutes: readInteger(quote, 'estimatedTravelMinutes'),
    estimatedDeliveryAt: readDateTime(quote, 'estimatedDeliveryAt'),
    expiresAt: readDateTime(quote, 'expiresAt'),
    createdAt: readDateTime(quote, 'createdAt'),
  };
}

function parseApiError(value: unknown): { code: string; retryable: boolean } | null {
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

function mapErrorKind(code: string, status: number): CustomerCheckoutQuoteFailureKind {
  if (code === 'AUTH_REQUIRED' || code === 'AUTH_TOKEN_EXPIRED' || status === 401) {
    return 'AUTHENTICATION';
  }
  if (code === 'CART_NOT_FOUND') {
    return 'EMPTY_CART';
  }
  if (code === 'VALIDATION_ERROR' || code === 'ADDRESS_NOT_FOUND') {
    return 'VALIDATION';
  }
  if (
    code === 'CART_ITEM_UNAVAILABLE' ||
    code === 'INSUFFICIENT_STOCK' ||
    code === 'INSUFFICIENT_INVENTORY' ||
    code === 'PRODUCT_INACTIVE' ||
    code === 'VARIANT_INACTIVE'
  ) {
    return 'UNAVAILABLE_ITEM';
  }
  if (code === 'CART_PRICE_CHANGED') {
    return 'CHANGED_PRICE';
  }
  if (code === 'ADDRESS_NOT_SERVICEABLE' || code === 'OUTSIDE_SERVICE_AREA') {
    return 'UNSERVICEABLE_ADDRESS';
  }
  if (code === 'CHECKOUT_QUOTE_EXPIRED' || code === 'CHECKOUT_QUOTE_NOT_FOUND') {
    return 'STALE_QUOTE';
  }
  if (code === 'SHOP_NOT_ACCEPTING_ORDERS' || code === 'SHOP_UNAVAILABLE') {
    return 'SHOP_UNAVAILABLE';
  }
  if (code === 'EXTERNAL_SERVICE_UNAVAILABLE' || status === 503) {
    return 'TEMPORARILY_UNAVAILABLE';
  }
  if (status === 400) {
    return 'VALIDATION';
  }
  if (status === 409) {
    return 'CONFLICT';
  }
  return 'UNKNOWN';
}

export class HttpCustomerCheckoutQuoteClient implements CustomerCheckoutQuotePort {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly getAccessToken: AccessTokenProvider,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {}

  public async createQuote(
    input: CreateCustomerCheckoutQuoteInput,
  ): Promise<CustomerCheckoutQuote> {
    if (!UUID_PATTERN.test(input.addressId)) {
      throw new CustomerCheckoutQuoteError('VALIDATION', 'VALIDATION_ERROR', false);
    }

    let accessToken: string | null;
    try {
      accessToken = await this.getAccessToken();
    } catch {
      throw new CustomerCheckoutQuoteError('AUTHENTICATION', null, false);
    }

    if (accessToken === null || accessToken.trim().length === 0) {
      throw new CustomerCheckoutQuoteError('AUTHENTICATION', null, false);
    }

    let response: HttpResponse;
    try {
      response = await this.fetchFunction(`${this.apiBaseUrl}/checkout/quote`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addressId: input.addressId }),
      });
    } catch {
      throw new CustomerCheckoutQuoteError('TRANSPORT', null, true);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new CustomerCheckoutQuoteError('MALFORMED_RESPONSE', null, false);
    }

    if (!response.ok) {
      const apiError = parseApiError(body);
      if (apiError === null) {
        throw new CustomerCheckoutQuoteError('UNKNOWN', null, false);
      }
      throw new CustomerCheckoutQuoteError(
        mapErrorKind(apiError.code, response.status),
        apiError.code,
        apiError.retryable,
      );
    }

    try {
      return parseCustomerCheckoutQuoteEnvelope(body);
    } catch {
      throw new CustomerCheckoutQuoteError('MALFORMED_RESPONSE', null, false);
    }
  }
}
