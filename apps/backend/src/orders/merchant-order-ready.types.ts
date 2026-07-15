export interface MerchantOrderReadyResult {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: 'READY_FOR_PICKUP';
  readonly readyAt: string;
  readonly totalLines: number;
  readonly packedLines: number;
  readonly allPacked: true;
  readonly replayed: boolean;
}

export interface MarkMerchantOrderReadyResponse {
  readonly success: true;
  readonly data: { readonly order: MerchantOrderReadyResult };
  readonly meta: { readonly requestId: null };
}
