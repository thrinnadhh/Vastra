export type MerchantInventoryMatchKind =
  'VARIANT_ID' | 'PRODUCT_ID' | 'SKU_EXACT' | 'SKU_PARTIAL' | 'PRODUCT';

export interface MerchantInventoryProductRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly brand: string | null;
  readonly isActive: boolean;
}

export interface MerchantInventoryVariantRecord {
  readonly id: string;
  readonly productId: string;
  readonly shopId: string;
  readonly sku: string;
  readonly colourName: string | null;
  readonly sizeLabel: string | null;
  readonly isActive: boolean;
}

export interface MerchantInventoryBalanceRecord {
  readonly stockOnHand: number;
  readonly reservedQuantity: number;
  readonly damagedQuantity: number;
  readonly reorderLevel: number;
  readonly version: number;
  readonly lastCountedAt: string | null;
  readonly updatedAt: string;
}

export interface MerchantInventoryRecord {
  readonly product: MerchantInventoryProductRecord;
  readonly variant: MerchantInventoryVariantRecord;
  readonly balance: MerchantInventoryBalanceRecord | null;
  readonly matchKind: MerchantInventoryMatchKind;
}

export interface MerchantInventoryProductSnapshot {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly brand: string | null;
  readonly isActive: boolean;
}

export interface MerchantInventoryVariantSnapshot {
  readonly id: string;
  readonly productId: string;
  readonly sku: string;
  readonly colourName: string | null;
  readonly sizeLabel: string | null;
  readonly isActive: boolean;
}

export interface MerchantInventoryBalanceSnapshot {
  readonly persisted: boolean;
  readonly stockOnHand: number;
  readonly reservedQuantity: number;
  readonly damagedQuantity: number;
  readonly availableQuantity: number;
  readonly reorderLevel: number;
  readonly version: number | null;
  readonly lastCountedAt: string | null;
  readonly updatedAt: string | null;
}

export interface MerchantInventoryLookupItem {
  readonly product: MerchantInventoryProductSnapshot;
  readonly variant: MerchantInventoryVariantSnapshot;
  readonly balance: MerchantInventoryBalanceSnapshot;
  readonly matchKind: MerchantInventoryMatchKind;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface GetMerchantInventoryBalanceResponse {
  readonly success: true;
  readonly data: {
    readonly inventory: MerchantInventoryLookupItem;
  };
  readonly meta: ResponseMeta;
}

export interface LookupMerchantInventoryResponse {
  readonly success: true;
  readonly data: {
    readonly query: string;
    readonly results: readonly MerchantInventoryLookupItem[];
  };
  readonly meta: ResponseMeta;
}
