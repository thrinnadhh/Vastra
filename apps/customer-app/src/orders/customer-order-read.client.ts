import {
  mapOrderErrorKind,
  parseApiError,
  parseCustomerOrderDetailEnvelope,
  parseCustomerOrdersPageEnvelope,
  UUID_PATTERN,
} from './customer-order.codec';
import {
  CustomerOrderError,
  type CustomerOrderDetail,
  type CustomerOrderReadPort,
  type CustomerOrdersPage,
  type ListCustomerOrdersInput,
} from './customer-order.types';

interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

type FetchFunction = (input: string, init: RequestInit) => Promise<HttpResponse>;
type AccessTokenProvider = () => Promise<string | null>;

export class HttpCustomerOrderReadClient implements CustomerOrderReadPort {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly getAccessToken: AccessTokenProvider,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {}

  public async listOrders(input: ListCustomerOrdersInput = {}): Promise<CustomerOrdersPage> {
    const limit = input.limit ?? 20;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || input.cursor?.length === 0) {
      throw new CustomerOrderError('VALIDATION', 'VALIDATION_ERROR', false);
    }

    const accessToken = await this.readAccessToken();
    const query = new URLSearchParams({ limit: String(limit) });
    if (input.cursor !== undefined) {
      query.set('cursor', input.cursor);
    }
    let response: HttpResponse;
    try {
      response = await this.fetchFunction(`${this.apiBaseUrl}/orders?${query.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      throw new CustomerOrderError('TRANSPORT', null, true);
    }
    return this.parseResponse(response, parseCustomerOrdersPageEnvelope);
  }

  public async getOrder(orderId: string): Promise<CustomerOrderDetail> {
    if (!UUID_PATTERN.test(orderId)) {
      throw new CustomerOrderError('VALIDATION', 'VALIDATION_ERROR', false);
    }
    const accessToken = await this.readAccessToken();
    let response: HttpResponse;
    try {
      response = await this.fetchFunction(
        `${this.apiBaseUrl}/orders/${encodeURIComponent(orderId)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
    } catch {
      throw new CustomerOrderError('TRANSPORT', null, true);
    }
    return this.parseResponse(response, parseCustomerOrderDetailEnvelope);
  }

  private async readAccessToken(): Promise<string> {
    let accessToken: string | null;
    try {
      accessToken = await this.getAccessToken();
    } catch {
      throw new CustomerOrderError('AUTHENTICATION', null, false);
    }
    if (accessToken === null || accessToken.trim().length === 0) {
      throw new CustomerOrderError('AUTHENTICATION', null, false);
    }
    return accessToken;
  }

  private async parseResponse<T>(
    response: HttpResponse,
    parseSuccess: (value: unknown) => T,
  ): Promise<T> {
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
      return parseSuccess(body);
    } catch {
      throw new CustomerOrderError('MALFORMED_RESPONSE', null, false);
    }
  }
}
