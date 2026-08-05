import {
  MerchantInventoryError,
  type MerchantBarcodeInventory,
  type MerchantInventoryBalance,
  type MerchantInventoryFailureKind,
  type MerchantInventoryPort,
  type MerchantOfflineSaleInput,
  type MerchantOfflineSaleResult,
  type MerchantShopSummary,
} from './merchant-inventory.types';

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

function invalidResponse(): never {
  throw new TypeError('Invalid merchant inventory response');
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`Expected ${label}`);
  return value;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : invalidResponse();
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return value === null ? null : typeof value === 'string' ? value : invalidResponse();
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  return typeof value === 'boolean' ? value : invalidResponse();
}

function readInteger(
  record: Record<string, unknown>,
  key: string,
  minimum = 0,
): number {
  const value = record[key];
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum
    ? value
    : invalidResponse();
}

function readNullableInteger(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  return value === null ? null : readInteger(record, key);
}

function readEnvelope(value: unknown): Record<string, unknown> {
  const root = readRecord(value, 'response');
  if (root['success'] !== true) invalidResponse();
  return readRecord(root['data'], 'response data');
}

function parseBalance(value: unknown): MerchantInventoryBalance {
  const balance = readRecord(value, 'inventory balance');
  return {
    persisted: readBoolean(balance, 'persisted'),
    stockOnHand: readInteger(balance, 'stockOnHand'),
    reservedQuantity: readInteger(balance, 'reservedQuantity'),
    damagedQuantity: readInteger(balance, 'damagedQuantity'),
    availableQuantity: readInteger(balance, 'availableQuantity'),
    reorderLevel: readInteger(balance, 'reorderLevel'),
    version: readNullableInteger(balance, 'version'),
    updatedAt: readNullableString(balance, 'updatedAt'),
  };
}

export function parseOwnedShops(value: unknown): readonly MerchantShopSummary[] {
  const shops = readEnvelope(value)['shops'];
  if (!Array.isArray(shops)) invalidResponse();
  return shops.map((entry) => {
    const shop = readRecord(entry, 'merchant shop');
    return {
      id: readString(shop, 'id'),
      name: readString(shop, 'name'),
      shopCode: readString(shop, 'shopCode'),
      operationalStatus: readString(shop, 'operationalStatus'),
    };
  });
}

export function parseBarcodeInventory(value: unknown): MerchantBarcodeInventory {
  const data = readEnvelope(value);
  const inventory = readRecord(data['inventory'], 'barcode inventory');
  const barcode = readRecord(inventory['barcode'], 'barcode');
  const product = readRecord(inventory['product'], 'product');
  const variant = readRecord(inventory['variant'], 'variant');
  return {
    scannedBarcode: readString(data, 'scannedBarcode'),
    barcode: {
      id: readString(barcode, 'id'),
      value: readString(barcode, 'value'),
      type: readString(barcode, 'type'),
      source: readString(barcode, 'source'),
      isPrimary: readBoolean(barcode, 'isPrimary'),
    },
    product: {
      id: readString(product, 'id'),
      name: readString(product, 'name'),
      brand: readNullableString(product, 'brand'),
      isActive: readBoolean(product, 'isActive'),
    },
    variant: {
      id: readString(variant, 'id'),
      productId: readString(variant, 'productId'),
      sku: readString(variant, 'sku'),
      colourName: readNullableString(variant, 'colourName'),
      sizeLabel: readNullableString(variant, 'sizeLabel'),
      isActive: readBoolean(variant, 'isActive'),
    },
    balance: parseBalance(inventory['balance']),
  };
}

export function parseOfflineSale(value: unknown): MerchantOfflineSaleResult {
  const sale = readRecord(readEnvelope(value)['sale'], 'offline sale');
  const items = sale['items'];
  if (!Array.isArray(items) || items.length !== 1) invalidResponse();
  const item = readRecord(items[0], 'offline sale item');
  return {
    id: readString(sale, 'id'),
    saleNumber: readString(sale, 'saleNumber'),
    totalPaise: readInteger(sale, 'totalPaise'),
    replayed: readBoolean(sale, 'replayed'),
    createdAt: readString(sale, 'createdAt'),
    balance: parseBalance(item['balance']),
  };
}

function parseApiError(
  value: unknown,
): { readonly code: string; readonly retryable: boolean } | null {
  if (!isRecord(value) || value['success'] !== false || !isRecord(value['error'])) {
    return null;
  }
  const code = value['error']['code'];
  const retryable = value['error']['retryable'];
  return typeof code === 'string' && typeof retryable === 'boolean'
    ? { code, retryable }
    : null;
}

function mapFailureKind(code: string, status: number): MerchantInventoryFailureKind {
  if (status === 401 || code === 'AUTH_REQUIRED' || code === 'AUTH_TOKEN_EXPIRED') {
    return 'AUTHENTICATION';
  }
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 400) return 'VALIDATION';
  if (status === 409) return 'CONFLICT';
  if (status === 503) return 'TEMPORARILY_UNAVAILABLE';
  return 'UNKNOWN';
}

export class HttpMerchantInventoryClient implements MerchantInventoryPort {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly getAccessToken: AccessTokenProvider,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {}

  public listOwnedShops(): Promise<readonly MerchantShopSummary[]> {
    return this.request(
      '/merchant/catalogue/shops',
      'GET',
      undefined,
      {},
      parseOwnedShops,
    );
  }

  public lookupBarcode(
    shopId: string,
    barcode: string,
  ): Promise<MerchantBarcodeInventory> {
    const query = new URLSearchParams({ barcode });
    return this.request(
      `/merchant/catalogue/shops/${encodeURIComponent(shopId)}/inventory/barcode-lookup?${query.toString()}`,
      'GET',
      undefined,
      {},
      parseBarcodeInventory,
    );
  }

  public createOfflineSale(
    input: MerchantOfflineSaleInput,
    idempotencyKey: string,
  ): Promise<MerchantOfflineSaleResult> {
    return this.request(
      '/merchant/offline-sales',
      'POST',
      input,
      { 'Idempotency-Key': idempotencyKey },
      parseOfflineSale,
    );
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST',
    body: unknown,
    additionalHeaders: Readonly<Record<string, string>>,
    parser: (value: unknown) => T,
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    if (accessToken === null) {
      throw new MerchantInventoryError('AUTHENTICATION', 'AUTH_REQUIRED', false);
    }

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
      throw new MerchantInventoryError('TRANSPORT', null, true);
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      throw new MerchantInventoryError('MALFORMED_RESPONSE', null, false);
    }

    if (!response.ok) {
      const error = parseApiError(responseBody);
      const code = error?.code ?? 'UNKNOWN';
      throw new MerchantInventoryError(
        mapFailureKind(code, response.status),
        error?.code ?? null,
        error?.retryable ?? response.status >= 500,
      );
    }

    try {
      return parser(responseBody);
    } catch {
      throw new MerchantInventoryError('MALFORMED_RESPONSE', null, false);
    }
  }
}
