import type {
  MerchantInventoryBalanceSnapshot,
  MerchantInventoryProductSnapshot,
  MerchantInventoryVariantSnapshot,
} from './merchant-inventory-balance.types';

export const MERCHANT_LOW_STOCK_STATES = ['OUT_OF_STOCK', 'LOW_STOCK'] as const;

export type MerchantLowStockState = (typeof MERCHANT_LOW_STOCK_STATES)[number];

export interface MerchantLowStockQuery {
  readonly limit: number;
  readonly includeInactive: boolean;
}

export interface MerchantLowStockItem {
  readonly product: MerchantInventoryProductSnapshot;
  readonly variant: MerchantInventoryVariantSnapshot;
  readonly balance: MerchantInventoryBalanceSnapshot;
  readonly inventoryState: MerchantLowStockState;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface ListMerchantLowStockInventoryResponse {
  readonly success: true;
  readonly data: {
    readonly items: readonly MerchantLowStockItem[];
  };
  readonly meta: ResponseMeta;
}
