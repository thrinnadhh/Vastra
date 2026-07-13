import type { MerchantInventoryBalanceSnapshot } from './merchant-inventory-balance.types';

export const MERCHANT_OFFLINE_SALE_PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'OTHER'] as const;

export type MerchantOfflineSalePaymentMethod =
  (typeof MERCHANT_OFFLINE_SALE_PAYMENT_METHODS)[number];

export const MERCHANT_OFFLINE_SALE_IDENTIFICATION_METHODS = ['BARCODE', 'MANUAL_SEARCH'] as const;

export type MerchantOfflineSaleIdentificationMethod =
  (typeof MERCHANT_OFFLINE_SALE_IDENTIFICATION_METHODS)[number];

export interface CreateMerchantOfflineSaleItemInput {
  readonly variantId: string;
  readonly quantity: number;
  readonly unitPricePaise: number;
  readonly discountPaise: number;
  readonly identificationMethod: MerchantOfflineSaleIdentificationMethod;
}

export interface CreateMerchantOfflineSaleInput {
  readonly shopId: string;
  readonly customerPhone: string | null;
  readonly taxPaise: number;
  readonly paymentMethod: MerchantOfflineSalePaymentMethod;
  readonly items: readonly CreateMerchantOfflineSaleItemInput[];
  readonly idempotencyKey: string;
}

export interface CreateMerchantOfflineSaleCommand extends CreateMerchantOfflineSaleInput {
  readonly actorId: string;
}

export interface MerchantOfflineSaleItemSnapshot {
  readonly id: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly unitPricePaise: number;
  readonly discountPaise: number;
  readonly totalPaise: number;
  readonly identificationMethod: MerchantOfflineSaleIdentificationMethod;
  readonly movementId: string;
  readonly balance: MerchantInventoryBalanceSnapshot;
}

export interface MerchantOfflineSaleSnapshot {
  readonly id: string;
  readonly saleNumber: string;
  readonly idempotencyKey: string;
  readonly replayed: boolean;
  readonly shopId: string;
  readonly merchantId: string;
  readonly customerPhone: string | null;
  readonly subtotalPaise: number;
  readonly discountPaise: number;
  readonly taxPaise: number;
  readonly totalPaise: number;
  readonly paymentMethod: MerchantOfflineSalePaymentMethod;
  readonly status: 'COMPLETED';
  readonly recordedBy: string;
  readonly createdAt: string;
  readonly items: readonly MerchantOfflineSaleItemSnapshot[];
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface MerchantOfflineSaleResponse {
  readonly success: true;
  readonly data: {
    readonly sale: MerchantOfflineSaleSnapshot;
  };
  readonly meta: ResponseMeta;
}
