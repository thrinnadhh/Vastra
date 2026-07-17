import {
  mapOrderErrorKind,
  parseApiError,
  parsePlacedCustomerCodOrderEnvelope,
  UUID_PATTERN,
} from './customer-order.codec';
import {
  CustomerOrderError,
  type CustomerOrderPlacementPort,
  type PlaceCustomerCodOrderInput,
  type PlacedCustomerCodOrder,
} from './customer-order.types';

interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

type FetchFunction = (input: string, init: RequestInit) => Promise<HttpResponse>;
type AccessTokenProvider = () => Promise<string | null>;

function validateInput(input: PlaceCustomerCodOrderInput): void {
  if (
    !UUID_PATTERN.test(input.cartId) ||
    !UUID_PATTERN.test(input.quoteId) ||
    !UUID_PATTERN.test(input.addressId) ||
    !UUID_PATTERN.test(input.idempotencyKey) ||
    (input.customerNote !== undefined &&
      input.customerNote !== null &&
      input.customerNote.length > 500)
  ) {
    throw new CustomerOrderError('VALIDATION', 'VALIDATION_ERROR', false);
  }
}

export class HttpCustomerOrderPlacementClient implements CustomerOrderPlacementPort {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly getAccessToken: AccessTokenProvider,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {}

  public async placeCodOrder(input: PlaceCustomerCodOrderInput): Promise<PlacedCustomerCodOrder> {
    validateInput(input);
    let accessToken: string | null;
    try {
      accessToken = await this.getAccessToken();
    } catch {
      throw new CustomerOrderError('AUTHENTICATION', null, false);
    }
    if (accessToken === null || accessToken.trim().length === 0) {
      throw new CustomerOrderError('AUTHENTICATION', null, false);
    }

    let response: HttpResponse;
    try {
      response = await this.fetchFunction(`${this.apiBaseUrl}/orders`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify({
          cartId: input.cartId,
          quoteId: input.quoteId,
          addressId: input.addressId,
          paymentMethod: 'COD',
          ...(input.customerNote === undefined ? {} : { customerNote: input.customerNote }),
        }),
      });
    } catch {
      throw new CustomerOrderError('TRANSPORT', null, true);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
    }
    if (!response.ok) {
      const error = parseApiError(body);
      if (error === null) {
        throw new CustomerOrderError('UNKNOWN', null, false);
      }
      throw new CustomerOrderError(
        mapOrderErrorKind(error.code, response.status),
        error.code,
        error.retryable,
      );
    }
    try {
      return parsePlacedCustomerCodOrderEnvelope(body);
    } catch {
      throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
    }
  }
}

export function createCustomerOrderIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/gu, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
