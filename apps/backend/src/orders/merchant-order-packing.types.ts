export const MERCHANT_ORDER_PACKING_STATUSES = ['MERCHANT_ACCEPTED', 'PACKING'] as const;
export type MerchantOrderPackingStatus = (typeof MERCHANT_ORDER_PACKING_STATUSES)[number];

export const MERCHANT_ORDER_ITEM_FULFILMENT_STATUSES = [
  'PENDING',
  'VERIFIED',
  'PACKED',
  'HANDED_OVER',
  'RETURNED',
  'CANCELLED',
] as const;
export type MerchantOrderItemFulfilmentStatus =
  (typeof MERCHANT_ORDER_ITEM_FULFILMENT_STATUSES)[number];

export const MERCHANT_ORDER_ITEM_VERIFICATION_METHODS = ['BARCODE', 'MANUAL'] as const;
export type MerchantOrderItemVerificationMethod =
  (typeof MERCHANT_ORDER_ITEM_VERIFICATION_METHODS)[number];

export const MERCHANT_ORDER_ITEM_VERIFICATION_RESULTS = [
  'MATCH',
  'MISMATCH',
  'OVERRIDDEN',
] as const;
export type MerchantOrderItemVerificationResult =
  (typeof MERCHANT_ORDER_ITEM_VERIFICATION_RESULTS)[number];

export interface MerchantOrderStartPackingResult {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: 'PACKING';
  readonly replayed: boolean;
}

export interface MerchantOrderPackingVerification {
  readonly method: MerchantOrderItemVerificationMethod;
  readonly result: MerchantOrderItemVerificationResult;
  readonly scannedBarcode: string | null;
  readonly verifiedAt: string;
}

export interface MerchantOrderPackingItem {
  readonly orderItemId: string;
  readonly productName: string;
  readonly sku: string;
  readonly colour: string | null;
  readonly size: string | null;
  readonly imageObjectKey: string | null;
  readonly quantity: number;
  readonly fulfilmentStatus: MerchantOrderItemFulfilmentStatus;
  readonly verification: MerchantOrderPackingVerification | null;
}

export interface MerchantOrderPackingList {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: MerchantOrderPackingStatus;
  readonly totalLines: number;
  readonly verifiedLines: number;
  readonly allVerified: boolean;
  readonly items: readonly MerchantOrderPackingItem[];
}

export interface MerchantOrderBarcodeVerificationInput {
  readonly method: 'BARCODE';
  readonly barcode: string;
}

export interface MerchantOrderManualVerificationInput {
  readonly method: 'MANUAL';
}

export type MerchantOrderItemVerificationInput =
  MerchantOrderBarcodeVerificationInput | MerchantOrderManualVerificationInput;

export interface MerchantOrderItemVerificationResultData {
  readonly orderId: string;
  readonly orderItemId: string;
  readonly fulfilmentStatus: MerchantOrderItemFulfilmentStatus;
  readonly method: MerchantOrderItemVerificationMethod;
  readonly result: 'MATCH' | 'MISMATCH';
  readonly scannedBarcode: string | null;
  readonly verified: boolean;
  readonly verifiedAt: string;
  readonly totalLines: number;
  readonly verifiedLines: number;
  readonly allVerified: boolean;
  readonly replayed: boolean;
}

interface MerchantOrderPackingResponseMeta {
  readonly requestId: null;
}

export interface StartMerchantOrderPackingResponse {
  readonly success: true;
  readonly data: { readonly order: MerchantOrderStartPackingResult };
  readonly meta: MerchantOrderPackingResponseMeta;
}

export interface GetMerchantOrderPackingListResponse {
  readonly success: true;
  readonly data: { readonly packingList: MerchantOrderPackingList };
  readonly meta: MerchantOrderPackingResponseMeta;
}

export interface VerifyMerchantOrderItemResponse {
  readonly success: true;
  readonly data: { readonly verification: MerchantOrderItemVerificationResultData };
  readonly meta: MerchantOrderPackingResponseMeta;
}
