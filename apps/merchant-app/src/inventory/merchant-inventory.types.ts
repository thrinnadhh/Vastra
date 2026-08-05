export type MerchantInventoryFailureKind =
  | 'AUTHENTICATION'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'TRANSPORT'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'MALFORMED_RESPONSE'
  | 'UNKNOWN';

export class MerchantInventoryError extends Error {
  public constructor(
    public readonly kind: MerchantInventoryFailureKind,
    public readonly code: string | null,
    public readonly retryable: boolean,
  ) {
    super(code ?? kind);
    this.name = 'MerchantInventoryError';
  }
}

export interface MerchantShopSummary {
  readonly id: string;
  readonly name: string;
  readonly shopCode: string;
  readonly operationalStatus: string;
}

export interface MerchantInventoryBalance {
  readonly persisted: boolean;
  readonly stockOnHand: number;
  readonly reservedQuantity: number;
  readonly damagedQuantity: number;
  readonly availableQuantity: number;
  readonly reorderLevel: number;
  readonly version: number | null;
  readonly updatedAt: string | null;
}

export interface MerchantBarcodeInventory {
  readonly scannedBarcode: string;
  readonly barcode: {
    readonly id: string;
    readonly value: string;
    readonly type: string;
    readonly source: string;
    readonly isPrimary: boolean;
  };
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly brand: string | null;
    readonly isActive: boolean;
  };
  readonly variant: {
    readonly id: string;
    readonly productId: string;
    readonly sku: string;
    readonly colourName: string | null;
    readonly sizeLabel: string | null;
    readonly isActive: boolean;
  };
  readonly balance: MerchantInventoryBalance;
}

export type MerchantOfflineSalePaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'OTHER';

export interface MerchantOfflineSaleInput {
  readonly shopId: string;
  readonly customerPhone: string | null;
  readonly taxPaise: number;
  readonly paymentMethod: MerchantOfflineSalePaymentMethod;
  readonly items: readonly [
    {
      readonly variantId: string;
      readonly quantity: number;
      readonly unitPricePaise: number;
      readonly discountPaise: number;
      readonly identificationMethod: 'BARCODE';
    },
  ];
}

export interface MerchantOfflineSaleResult {
  readonly id: string;
  readonly saleNumber: string;
  readonly totalPaise: number;
  readonly replayed: boolean;
  readonly createdAt: string;
  readonly balance: MerchantInventoryBalance;
}

export interface MerchantInventoryPort {
  listOwnedShops(): Promise<readonly MerchantShopSummary[]>;
  lookupBarcode(shopId: string, barcode: string): Promise<MerchantBarcodeInventory>;
  createOfflineSale(
    input: MerchantOfflineSaleInput,
    idempotencyKey: string,
  ): Promise<MerchantOfflineSaleResult>;
}

export interface PendingMerchantOfflineSale {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly input: MerchantOfflineSaleInput;
  readonly barcode: string;
  readonly productName: string;
  readonly createdAt: string;
  readonly attemptCount: number;
  readonly lastAttemptAt: string | null;
  readonly lastErrorCode: string | null;
  readonly blocked: boolean;
}

export interface MerchantInventoryCachePort {
  get(shopId: string, barcode: string): Promise<MerchantBarcodeInventory | null>;
  put(shopId: string, inventory: MerchantBarcodeInventory): Promise<void>;
}

export interface CompletedMerchantOfflineSale {
  readonly pending: PendingMerchantOfflineSale;
  readonly result: MerchantOfflineSaleResult;
}

export interface MerchantOfflineSaleQueuePort {
  list(): Promise<readonly PendingMerchantOfflineSale[]>;
  remove(id: string): Promise<readonly PendingMerchantOfflineSale[]>;
  enqueue(
    input: Omit<
      PendingMerchantOfflineSale,
      'attemptCount' | 'lastAttemptAt' | 'lastErrorCode' | 'blocked'
    >,
  ): Promise<readonly PendingMerchantOfflineSale[]>;
  sync(client: MerchantInventoryPort): Promise<{
    readonly remaining: readonly PendingMerchantOfflineSale[];
    readonly completed: readonly CompletedMerchantOfflineSale[];
  }>;
}
