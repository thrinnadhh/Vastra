import type { MerchantOrderStatus } from '../orders/merchant-order.types';

export function merchantAlertSecondsRemaining(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1_000));
}

export function shouldStopMerchantAlertForOrderStatus(status: MerchantOrderStatus): boolean {
  return status !== 'WAITING_FOR_MERCHANT';
}
