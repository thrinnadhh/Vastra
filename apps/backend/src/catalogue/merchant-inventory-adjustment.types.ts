import type { MerchantInventoryBalanceSnapshot } from './merchant-inventory-balance.types';

export const MERCHANT_INVENTORY_ADJUSTMENT_ACTIONS = [
  'ADD_STOCK',
  'RETURN_TO_STOCK',
  'MARK_DAMAGED',
  'STOCK_CORRECTION',
  'STOCK_CHECK',
] as const;

export type MerchantInventoryAdjustmentAction =
  (typeof MERCHANT_INVENTORY_ADJUSTMENT_ACTIONS)[number];

export type MerchantInventoryMovementType =
  | 'STOCK_RECEIVED'
  | 'OFFLINE_SALE'
  | 'ONLINE_ORDER_RESERVED'
  | 'ONLINE_ORDER_RELEASED'
  | 'ONLINE_ORDER_COMPLETED'
  | 'RETURN_TO_STOCK'
  | 'MARKED_DAMAGED'
  | 'STOCK_CORRECTION'
  | 'STOCK_AUDIT';

export type MerchantInventorySourceMethod =
  'BARCODE' | 'PHOTO_MATCH' | 'MANUAL_SEARCH' | 'SYSTEM' | 'ADMIN';

export interface MerchantOwnedInventoryVariant {
  readonly id: string;
  readonly shopId: string;
  readonly isActive: boolean;
}

export interface CreateMerchantInventoryAdjustmentInput {
  readonly variantId: string;
  readonly action: MerchantInventoryAdjustmentAction;
  readonly quantity: number;
  readonly reason: string;
  readonly expectedVersion: number | null;
  readonly idempotencyKey: string;
}

export interface ApplyMerchantInventoryAdjustmentCommand extends CreateMerchantInventoryAdjustmentInput {
  readonly shopId: string;
  readonly actorId: string;
}

export interface MerchantInventoryMovementSnapshot {
  readonly id: string;
  readonly shopId: string;
  readonly variantId: string;
  readonly movementType: MerchantInventoryMovementType;
  readonly quantityChange: number;
  readonly reservedChange: number;
  readonly damagedChange: number;
  readonly stockBefore: number;
  readonly stockAfter: number;
  readonly reservedBefore: number;
  readonly reservedAfter: number;
  readonly damagedBefore: number;
  readonly damagedAfter: number;
  readonly referenceType: string | null;
  readonly referenceId: string | null;
  readonly reason: string | null;
  readonly performedBy: string | null;
  readonly sourceMethod: MerchantInventorySourceMethod;
  readonly createdAt: string;
}

export interface MerchantInventoryAdjustmentSnapshot {
  readonly idempotencyKey: string;
  readonly replayed: boolean;
  readonly action: MerchantInventoryAdjustmentAction;
  readonly movement: MerchantInventoryMovementSnapshot;
  readonly balance: MerchantInventoryBalanceSnapshot;
}

export interface MerchantInventoryMovementQuery {
  readonly variantId: string;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface MerchantInventoryMovementPage {
  readonly movements: readonly MerchantInventoryMovementSnapshot[];
  readonly nextCursor: string | null;
}

interface ResponseMeta {
  readonly requestId: null;
}

export interface MerchantInventoryAdjustmentResponse {
  readonly success: true;
  readonly data: {
    readonly adjustment: MerchantInventoryAdjustmentSnapshot;
  };
  readonly meta: ResponseMeta;
}

export interface ListMerchantInventoryMovementsResponse {
  readonly success: true;
  readonly data: {
    readonly variantId: string;
    readonly movements: readonly MerchantInventoryMovementSnapshot[];
    readonly nextCursor: string | null;
  };
  readonly meta: ResponseMeta;
}
