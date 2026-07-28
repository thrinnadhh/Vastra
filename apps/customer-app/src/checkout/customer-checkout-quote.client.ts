import {
  CustomerCheckoutQuoteError,
  type CreateCustomerCheckoutQuoteInput,
  type CustomerCheckoutQuote,
  type CustomerCheckoutQuoteAddress,
  type CustomerCheckoutQuoteBranch,
  type CustomerCheckoutQuoteFailureKind,
  type CustomerCheckoutQuoteGeography,
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

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError('Invalid checkout quote response');
  return value;
}

function string(value: Record<string, unknown>, key: string): string {
  const result = value[key];
  if (typeof result !== 'string' || result.length === 0) {
    throw new TypeError('Invalid checkout quote response');
  }
  return result;
}

function uuid(value: Record<string, unknown>, key: string): string {
  const result = string(value, key);
  if (!UUID_PATTERN.test(result)) throw new TypeError('Invalid checkout quote response');
  return result;
}

function nullableString(value: Record<string, unknown>, key: string): string | null {
  const result = value[key];
  if (result === null) return null;
  if (typeof result !== 'string') throw new TypeError('Invalid checkout quote response');
  return result;
}

function bool(value: Record<string, unknown>, key: string): boolean {
  const result = value[key];
  if (typeof result !== 'boolean') throw new TypeError('Invalid checkout quote response');
  return result;
}

function integer(
  value: Record<string, unknown>,
  key: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const result = value[key];
  if (
    typeof result !== 'number' ||
    !Number.isSafeInteger(result) ||
    result < minimum ||
    result > maximum
  ) {
    throw new TypeError('Invalid checkout quote response');
  }
  return result;
}

function coordinate(
  value: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const result = value[key];
  if (
    typeof result !== 'number' ||
    !Number.isFinite(result) ||
    result < minimum ||
    result > maximum
  ) {
    throw new TypeError('Invalid checkout quote response');
  }
  return result;
}

function dateTime(value: Record<string, unknown>, key: string): string {
  const result = string(value, key);
  if (!Number.isFinite(Date.parse(result))) throw new TypeError('Invalid checkout quote response');
  return result;
}

function parseAddress(value: unknown): CustomerCheckoutQuoteAddress {
  const input = record(value);
  return {
    id: uuid(input, 'id'),
    label: nullableString(input, 'label'),
    recipientName: string(input, 'recipientName'),
    phoneNumber: string(input, 'phoneNumber'),
    line1: string(input, 'line1'),
    line2: nullableString(input, 'line2'),
    landmark: nullableString(input, 'landmark'),
    area: string(input, 'area'),
    city: string(input, 'city'),
    state: string(input, 'state'),
    postalCode: string(input, 'postalCode'),
    countryCode: string(input, 'countryCode'),
    latitude: coordinate(input, 'latitude', -90, 90),
    longitude: coordinate(input, 'longitude', -180, 180),
  };
}

function parseShop(value: unknown): CustomerCheckoutQuoteShop {
  const input = record(value);
  return {
    id: uuid(input, 'id'),
    name: string(input, 'name'),
    slug: string(input, 'slug'),
    minimumOrderPaise: integer(input, 'minimumOrderPaise'),
  };
}

function parseBranch(value: unknown): CustomerCheckoutQuoteBranch {
  const input = record(value);
  const type = input['type'];
  if (type !== 'PHYSICAL_STORE' && type !== 'CLOUD_SHOP') {
    throw new TypeError('Invalid checkout quote response');
  }
  return {
    id: uuid(input, 'id'),
    code: string(input, 'code'),
    name: string(input, 'name'),
    type,
    addressId: uuid(input, 'addressId'),
    returnAddressId: uuid(input, 'returnAddressId'),
    pincode: nullableString(input, 'pincode'),
    latitude: coordinate(input, 'latitude', -90, 90),
    longitude: coordinate(input, 'longitude', -180, 180),
  };
}

function parseGeography(value: unknown): CustomerCheckoutQuoteGeography {
  const input = record(value);
  if (input['fulfilmentMode'] !== 'LOCAL_DELIVERY') {
    throw new TypeError('Invalid checkout quote response');
  }
  const distanceMeters = integer(input, 'distanceMeters');
  const deliveryRadiusMeters = integer(input, 'deliveryRadiusMeters', 1);
  if (distanceMeters > deliveryRadiusMeters) throw new TypeError('Invalid checkout quote response');
  return {
    cityId: uuid(input, 'cityId'),
    cityCode: string(input, 'cityCode'),
    cityName: string(input, 'cityName'),
    serviceZoneId: uuid(input, 'serviceZoneId'),
    serviceZoneCode: string(input, 'serviceZoneCode'),
    serviceZoneName: string(input, 'serviceZoneName'),
    customerPincode: string(input, 'customerPincode'),
    fulfilmentMode: 'LOCAL_DELIVERY',
    distanceMeters,
    deliveryRadiusMeters,
  };
}

function parseItem(value: unknown): CustomerCheckoutQuoteItem {
  const input = record(value);
  const quantity = integer(input, 'quantity', 1, 20);
  const previousUnitPricePaise = integer(input, 'previousUnitPricePaise');
  const unitPricePaise = integer(input, 'unitPricePaise');
  const availableQuantity = integer(input, 'availableQuantity');
  const lineTotalPaise = integer(input, 'lineTotalPaise');
  const priceChanged = bool(input, 'priceChanged');
  if (
    lineTotalPaise !== quantity * unitPricePaise ||
    availableQuantity < quantity ||
    priceChanged !== (previousUnitPricePaise !== unitPricePaise)
  ) {
    throw new TypeError('Invalid checkout quote response');
  }
  return {
    cartItemId: uuid(input, 'cartItemId'),
    variantId: uuid(input, 'variantId'),
    productId: uuid(input, 'productId'),
    productName: string(input, 'productName'),
    sku: string(input, 'sku'),
    colourName: nullableString(input, 'colourName'),
    sizeLabel: nullableString(input, 'sizeLabel'),
    quantity,
    previousUnitPricePaise,
    unitPricePaise,
    priceChanged,
    availableQuantity,
    branchInventoryVersion: integer(input, 'branchInventoryVersion', 1),
    lineTotalPaise,
  };
}

function parseTotals(value: unknown): CustomerCheckoutQuoteTotals {
  const input = record(value);
  const result = {
    subtotalPaise: integer(input, 'subtotalPaise'),
    productDiscountPaise: integer(input, 'productDiscountPaise'),
    couponDiscountPaise: integer(input, 'couponDiscountPaise'),
    deliveryFeePaise: integer(input, 'deliveryFeePaise'),
    platformFeePaise: integer(input, 'platformFeePaise'),
    taxPaise: integer(input, 'taxPaise'),
    totalPaise: integer(input, 'totalPaise'),
  };
  if (
    result.productDiscountPaise + result.couponDiscountPaise > result.subtotalPaise ||
    result.totalPaise !==
      result.subtotalPaise -
        result.productDiscountPaise -
        result.couponDiscountPaise +
        result.deliveryFeePaise +
        result.platformFeePaise +
        result.taxPaise
  ) {
    throw new TypeError('Invalid checkout quote response');
  }
  return result;
}

export function parseCustomerCheckoutQuoteEnvelope(value: unknown): CustomerCheckoutQuote {
  const envelope = record(value);
  if (envelope['success'] !== true) throw new TypeError('Invalid checkout quote response');
  const data = record(envelope['data']);
  const quote = record(data['quote']);
  if (quote['contractVersion'] !== 2 || quote['fulfilmentMode'] !== 'LOCAL_DELIVERY') {
    throw new TypeError('Invalid checkout quote response');
  }
  const rawItems = quote['items'];
  const meta = record(envelope['meta']);
  const requestId = meta['requestId'];
  if (
    !Array.isArray(rawItems) ||
    rawItems.length === 0 ||
    (requestId !== null && (typeof requestId !== 'string' || !UUID_PATTERN.test(requestId)))
  ) {
    throw new TypeError('Invalid checkout quote response');
  }
  const items = rawItems.map(parseItem);
  const totals = parseTotals(quote['totals']);
  const codEligible = bool(quote, 'codEligible');
  const codLimitPaise = integer(quote, 'codLimitPaise');
  if (
    totals.subtotalPaise !== items.reduce((sum, item) => sum + item.lineTotalPaise, 0) ||
    codEligible !== totals.totalPaise <= codLimitPaise
  ) {
    throw new TypeError('Invalid checkout quote response');
  }
  const createdAt = dateTime(quote, 'createdAt');
  const expiresAt = dateTime(quote, 'expiresAt');
  const estimatedDeliveryAt = dateTime(quote, 'estimatedDeliveryAt');
  if (
    Date.parse(expiresAt) <= Date.parse(createdAt) ||
    Date.parse(estimatedDeliveryAt) < Date.parse(createdAt)
  ) {
    throw new TypeError('Invalid checkout quote response');
  }
  return {
    id: uuid(quote, 'id'),
    contractVersion: 2,
    cartId: uuid(quote, 'cartId'),
    address: parseAddress(quote['address']),
    shop: parseShop(quote['shop']),
    branch: parseBranch(quote['branch']),
    geography: parseGeography(quote['geography']),
    items,
    totals,
    fulfilmentMode: 'LOCAL_DELIVERY',
    codEligible,
    codLimitPaise,
    estimatedPreparationMinutes: integer(quote, 'estimatedPreparationMinutes'),
    estimatedTravelMinutes: integer(quote, 'estimatedTravelMinutes'),
    estimatedDeliveryAt,
    cityConfigurationVersion: integer(quote, 'cityConfigurationVersion', 1),
    expiresAt,
    createdAt,
  };
}

function parseApiError(value: unknown): { code: string; retryable: boolean } | null {
  if (!isRecord(value) || value['success'] !== false || !isRecord(value['error'])) return null;
  const code = value['error']['code'];
  const retryable = value['error']['retryable'];
  if (typeof code !== 'string' || typeof retryable !== 'boolean') return null;
  return { code, retryable };
}

function mapErrorKind(code: string, status: number): CustomerCheckoutQuoteFailureKind {
  if (code === 'AUTH_REQUIRED' || code === 'AUTH_TOKEN_EXPIRED' || status === 401)
    return 'AUTHENTICATION';
  if (code === 'CART_NOT_FOUND') return 'EMPTY_CART';
  if (code === 'VALIDATION_ERROR' || code === 'ADDRESS_NOT_FOUND') return 'VALIDATION';
  if (
    [
      'CART_ITEM_UNAVAILABLE',
      'INSUFFICIENT_STOCK',
      'INSUFFICIENT_INVENTORY',
      'PRODUCT_INACTIVE',
      'VARIANT_INACTIVE',
    ].includes(code)
  )
    return 'UNAVAILABLE_ITEM';
  if (code === 'CART_PRICE_CHANGED') return 'CHANGED_PRICE';
  if (code === 'NO_FULFILMENT_BRANCH') return 'NO_FULFILMENT_BRANCH';
  if (code === 'POSTAL_PRICING_REQUIRED') return 'POSTAL_PRICING_REQUIRED';
  if (code === 'ADDRESS_NOT_SERVICEABLE' || code === 'OUTSIDE_SERVICE_AREA')
    return 'UNSERVICEABLE_ADDRESS';
  if (
    [
      'CHECKOUT_QUOTE_EXPIRED',
      'CHECKOUT_QUOTE_NOT_FOUND',
      'CHECKOUT_QUOTE_VERSION_UNSUPPORTED',
    ].includes(code)
  )
    return 'STALE_QUOTE';
  if (code === 'SHOP_NOT_ACCEPTING_ORDERS' || code === 'SHOP_UNAVAILABLE')
    return 'SHOP_UNAVAILABLE';
  if (code === 'EXTERNAL_SERVICE_UNAVAILABLE' || status === 503) return 'TEMPORARILY_UNAVAILABLE';
  if (status === 400) return 'VALIDATION';
  if (status === 409) return 'CONFLICT';
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
      if (apiError === null) throw new CustomerCheckoutQuoteError('UNKNOWN', null, false);
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
