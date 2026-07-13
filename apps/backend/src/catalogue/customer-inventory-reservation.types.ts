import type { MerchantInventoryMovementSnapshot } from './merchant-inventory-adjustment.types';
import type { MerchantInventoryBalanceSnapshot } from './merchant-inventory-balance.types';

export const CUSTOMER_INVENTORY_RESERVATION_STATUSES = [
  'ACTIVE',
  'CONVERTED',
  'RELEASED',
  'EXPIRED',
] as const;

export type CustomerInventoryReservationStatus =
  (typeof CUSTOMER_INVENTORY_RESERVATION_STATUSES)[number];

export interface CustomerOwnedCartRecord {
  readonly id: string;
  readonly shopId: string;
  readonly status: string;
}

export interface CustomerVisibleVariantRecord {
  readonly id: string;
  readonly shopId: string;
  readonly isActive: boolean;
}

export interface CustomerOwnedReservationRecord {
  readonly id: string;
  readonly shopId: string;
  readonly variantId: string;
  readonly cartId: string;
  readonly status: CustomerInventoryReservationStatus;
}

export interface CreateCustomerInventoryReservationInput {
  readonly cartId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly ttlSeconds: number;
  readonly idempotencyKey: string;
}

export interface CreateCustomerInventoryReservationCommand extends CreateCustomerInventoryReservationInput {
  readonly actorId: string;
}

export interface ReleaseCustomerInventoryReservationInput {
  readonly reservationId: string;
  readonly reason: string;
}

export interface ReleaseCustomerInventoryReservationCommand extends ReleaseCustomerInventoryReservationInput {
  readonly actorId: string;
}

export interface CustomerInventoryReservationSnapshot {
  readonly id: string;
  readonly idempotencyKey: string | null;
  readonly replayed: boolean;
  readonly shopId: string;
  readonly variantId: string;
  readonly cartId: string;
  readonly quantity: number;
  readonly status: CustomerInventoryReservationStatus;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly releasedAt: string | null;
  readonly movement: MerchantInventoryMovementSnapshot;
  readonly balance: MerchantInventoryBalanceSnapshot;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface CustomerInventoryReservationResponse {
  readonly success: true;
  readonly data: {
    readonly reservation: CustomerInventoryReservationSnapshot;
  };
  readonly meta: ResponseMeta;
}
