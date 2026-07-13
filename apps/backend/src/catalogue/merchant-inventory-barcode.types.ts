import type {
  MerchantInventoryBalanceRecord,
  MerchantInventoryBalanceSnapshot,
  MerchantInventoryProductRecord,
  MerchantInventoryProductSnapshot,
  MerchantInventoryVariantRecord,
  MerchantInventoryVariantSnapshot,
} from './merchant-inventory-balance.types';

export type MerchantInventoryBarcodeType = 'EAN13' | 'UPC' | 'CODE128' | 'QR' | 'INTERNAL';

export type MerchantInventoryBarcodeSource =
  'MANUFACTURER' | 'VASTRA_GENERATED' | 'MERCHANT_ENTERED';

export interface MerchantInventoryBarcodeRecord {
  readonly id: string;
  readonly variantId: string;
  readonly value: string;
  readonly type: MerchantInventoryBarcodeType;
  readonly source: MerchantInventoryBarcodeSource;
  readonly isPrimary: boolean;
}

export interface MerchantInventoryBarcodeLookupRecord {
  readonly barcode: MerchantInventoryBarcodeRecord;
  readonly product: MerchantInventoryProductRecord;
  readonly variant: MerchantInventoryVariantRecord;
  readonly balance: MerchantInventoryBalanceRecord | null;
}

export interface MerchantInventoryBarcodeSnapshot {
  readonly id: string;
  readonly value: string;
  readonly type: MerchantInventoryBarcodeType;
  readonly source: MerchantInventoryBarcodeSource;
  readonly isPrimary: boolean;
}

export interface MerchantInventoryBarcodeLookupSnapshot {
  readonly barcode: MerchantInventoryBarcodeSnapshot;
  readonly product: MerchantInventoryProductSnapshot;
  readonly variant: MerchantInventoryVariantSnapshot;
  readonly balance: MerchantInventoryBalanceSnapshot;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface LookupMerchantInventoryByBarcodeResponse {
  readonly success: true;
  readonly data: {
    readonly scannedBarcode: string;
    readonly inventory: MerchantInventoryBarcodeLookupSnapshot;
  };
  readonly meta: ResponseMeta;
}
