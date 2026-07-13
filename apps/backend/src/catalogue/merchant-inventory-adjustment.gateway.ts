import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { MerchantInventoryBalanceSnapshot } from './merchant-inventory-balance.types';
import type {
  ApplyMerchantInventoryAdjustmentCommand,
  MerchantInventoryAdjustmentAction,
  MerchantInventoryAdjustmentSnapshot,
  MerchantInventoryMovementPage,
  MerchantInventoryMovementSnapshot,
  MerchantInventoryMovementType,
  MerchantInventorySourceMethod,
  MerchantOwnedInventoryVariant,
} from './merchant-inventory-adjustment.types';

export interface MerchantInventoryAdjustmentGateway {
  findOwnedVariant(
    client: SupabaseClient,
    variantId: string,
  ): Promise<MerchantOwnedInventoryVariant | null>;

  applyAdjustment(
    command: ApplyMerchantInventoryAdjustmentCommand,
  ): Promise<MerchantInventoryAdjustmentSnapshot>;

  listOwnedMovements(
    client: SupabaseClient,
    variantId: string,
    cursor: string | null,
    limit: number,
  ): Promise<MerchantInventoryMovementPage>;
}

export class MerchantInventoryAdjustmentGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant inventory adjustment provider unavailable');
    this.name = 'MerchantInventoryAdjustmentGatewayUnavailableError';
  }
}

export class MerchantInventoryAdjustmentDataInvalidError extends Error {
  public constructor() {
    super('Merchant inventory adjustment data invalid');
    this.name = 'MerchantInventoryAdjustmentDataInvalidError';
  }
}

export class MerchantInventoryAdjustmentConstraintError extends Error {
  public constructor() {
    super('Merchant inventory adjustment violates a database constraint');
    this.name = 'MerchantInventoryAdjustmentConstraintError';
  }
}

export class MerchantInventoryAdjustmentIdempotencyConflictError extends Error {
  public constructor() {
    super('Merchant inventory adjustment idempotency key conflicts');
    this.name = 'MerchantInventoryAdjustmentIdempotencyConflictError';
  }
}

export class MerchantInventoryAdjustmentVersionConflictError extends Error {
  public constructor() {
    super('Merchant inventory adjustment version conflicts');
    this.name = 'MerchantInventoryAdjustmentVersionConflictError';
  }
}

export class MerchantInventoryAdjustmentNegativeInventoryError extends Error {
  public constructor() {
    super('Merchant inventory adjustment would create invalid inventory');
    this.name = 'MerchantInventoryAdjustmentNegativeInventoryError';
  }
}

export class MerchantInventoryAdjustmentVariantNotFoundError extends Error {
  public constructor() {
    super('Merchant inventory adjustment variant not found');
    this.name = 'MerchantInventoryAdjustmentVariantNotFoundError';
  }
}

const MOVEMENT_TYPES = new Set<MerchantInventoryMovementType>([
  'STOCK_RECEIVED',
  'OFFLINE_SALE',
  'ONLINE_ORDER_RESERVED',
  'ONLINE_ORDER_RELEASED',
  'ONLINE_ORDER_COMPLETED',
  'RETURN_TO_STOCK',
  'MARKED_DAMAGED',
  'STOCK_CORRECTION',
  'STOCK_AUDIT',
]);

const SOURCE_METHODS = new Set<MerchantInventorySourceMethod>([
  'BARCODE',
  'PHOTO_MATCH',
  'MANUAL_SEARCH',
  'SYSTEM',
  'ADMIN',
]);

const ADJUSTMENT_ACTIONS = new Set<MerchantInventoryAdjustmentAction>([
  'ADD_STOCK',
  'RETURN_TO_STOCK',
  'MARK_DAMAGED',
  'STOCK_CORRECTION',
  'STOCK_CHECK',
]);

const MOVEMENT_SELECT = [
  'id',
  'shop_id',
  'variant_id',
  'movement_type',
  'quantity_change',
  'reserved_change',
  'damaged_change',
  'stock_before',
  'stock_after',
  'reserved_before',
  'reserved_after',
  'damaged_before',
  'damaged_after',
  'reference_type',
  'reference_id',
  'reason',
  'performed_by',
  'source_method',
  'created_at',
].join(', ');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return value;
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return Number(value);
  }

  return Number.NaN;
}

function requireInteger(record: Record<string, unknown>, key: string): number {
  const value = parseNumeric(record[key]);

  if (!Number.isSafeInteger(value)) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return value;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = requireInteger(record, key);

  if (value < 0) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireInteger(record, key);

  if (value <= 0) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return value;
}

function requireNullablePositiveInteger(
  record: Record<string, unknown>,
  key: string,
): number | null {
  if (record[key] === null) {
    return null;
  }

  return requirePositiveInteger(record, key);
}

function requireMovementType(
  record: Record<string, unknown>,
  key: string,
): MerchantInventoryMovementType {
  const value = record[key];

  if (typeof value !== 'string' || !MOVEMENT_TYPES.has(value as MerchantInventoryMovementType)) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return value as MerchantInventoryMovementType;
}

function requireSourceMethod(
  record: Record<string, unknown>,
  key: string,
): MerchantInventorySourceMethod {
  const value = record[key];

  if (typeof value !== 'string' || !SOURCE_METHODS.has(value as MerchantInventorySourceMethod)) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return value as MerchantInventorySourceMethod;
}

function requireAdjustmentAction(
  record: Record<string, unknown>,
  key: string,
): MerchantInventoryAdjustmentAction {
  const value = record[key];

  if (
    typeof value !== 'string' ||
    !ADJUSTMENT_ACTIONS.has(value as MerchantInventoryAdjustmentAction)
  ) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return value as MerchantInventoryAdjustmentAction;
}

function parseOwnedVariant(value: unknown): MerchantOwnedInventoryVariant {
  if (!isRecord(value)) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    shopId: requireString(value, 'shop_id'),
    isActive: requireBoolean(value, 'is_active'),
  };
}

function parseNullableOwnedVariant(value: unknown): MerchantOwnedInventoryVariant | null {
  return value === null ? null : parseOwnedVariant(value);
}

function parseMovement(value: unknown): MerchantInventoryMovementSnapshot {
  if (!isRecord(value)) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  const idValue = value['id'];
  const id =
    typeof idValue === 'string'
      ? idValue
      : typeof idValue === 'number' && Number.isSafeInteger(idValue)
        ? String(idValue)
        : null;

  if (id === null || !/^[1-9][0-9]*$/u.test(id)) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return {
    id,
    shopId: requireString(value, 'shopId' in value ? 'shopId' : 'shop_id'),
    variantId: requireString(value, 'variantId' in value ? 'variantId' : 'variant_id'),
    movementType: requireMovementType(
      value,
      'movementType' in value ? 'movementType' : 'movement_type',
    ),
    quantityChange: requireInteger(
      value,
      'quantityChange' in value ? 'quantityChange' : 'quantity_change',
    ),
    reservedChange: requireInteger(
      value,
      'reservedChange' in value ? 'reservedChange' : 'reserved_change',
    ),
    damagedChange: requireInteger(
      value,
      'damagedChange' in value ? 'damagedChange' : 'damaged_change',
    ),
    stockBefore: requireNonNegativeInteger(
      value,
      'stockBefore' in value ? 'stockBefore' : 'stock_before',
    ),
    stockAfter: requireNonNegativeInteger(
      value,
      'stockAfter' in value ? 'stockAfter' : 'stock_after',
    ),
    reservedBefore: requireNonNegativeInteger(
      value,
      'reservedBefore' in value ? 'reservedBefore' : 'reserved_before',
    ),
    reservedAfter: requireNonNegativeInteger(
      value,
      'reservedAfter' in value ? 'reservedAfter' : 'reserved_after',
    ),
    damagedBefore: requireNonNegativeInteger(
      value,
      'damagedBefore' in value ? 'damagedBefore' : 'damaged_before',
    ),
    damagedAfter: requireNonNegativeInteger(
      value,
      'damagedAfter' in value ? 'damagedAfter' : 'damaged_after',
    ),
    referenceType: requireNullableString(
      value,
      'referenceType' in value ? 'referenceType' : 'reference_type',
    ),
    referenceId: requireNullableString(
      value,
      'referenceId' in value ? 'referenceId' : 'reference_id',
    ),
    reason: requireNullableString(value, 'reason'),
    performedBy: requireNullableString(
      value,
      'performedBy' in value ? 'performedBy' : 'performed_by',
    ),
    sourceMethod: requireSourceMethod(
      value,
      'sourceMethod' in value ? 'sourceMethod' : 'source_method',
    ),
    createdAt: requireString(value, 'createdAt' in value ? 'createdAt' : 'created_at'),
  };
}

function parseBalance(value: unknown): MerchantInventoryBalanceSnapshot {
  if (!isRecord(value)) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  const stockOnHand = requireNonNegativeInteger(value, 'stockOnHand');
  const reservedQuantity = requireNonNegativeInteger(value, 'reservedQuantity');
  const damagedQuantity = requireNonNegativeInteger(value, 'damagedQuantity');
  const availableQuantity = requireNonNegativeInteger(value, 'availableQuantity');

  if (availableQuantity !== stockOnHand - reservedQuantity - damagedQuantity) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return {
    persisted: requireBoolean(value, 'persisted'),
    stockOnHand,
    reservedQuantity,
    damagedQuantity,
    availableQuantity,
    reorderLevel: requireNonNegativeInteger(value, 'reorderLevel'),
    version: requireNullablePositiveInteger(value, 'version'),
    lastCountedAt: requireNullableString(value, 'lastCountedAt'),
    updatedAt: requireNullableString(value, 'updatedAt'),
  };
}

function parseAdjustment(value: unknown): MerchantInventoryAdjustmentSnapshot {
  if (!isRecord(value)) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return {
    idempotencyKey: requireString(value, 'idempotencyKey'),
    replayed: requireBoolean(value, 'replayed'),
    action: requireAdjustmentAction(value, 'action'),
    movement: parseMovement(value['movement']),
    balance: parseBalance(value['balance']),
  };
}

function parseMovementRows(value: unknown): readonly MerchantInventoryMovementSnapshot[] {
  if (!Array.isArray(value)) {
    throw new MerchantInventoryAdjustmentDataInvalidError();
  }

  return value.map((row) => parseMovement(row));
}

function readPostgresCode(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const code = value['code'];
  return typeof code === 'string' ? code : null;
}

function throwForAdjustmentError(error: unknown): never {
  const code = readPostgresCode(error);

  if (code === 'P0002') {
    throw new MerchantInventoryAdjustmentIdempotencyConflictError();
  }

  if (code === '40001') {
    throw new MerchantInventoryAdjustmentVersionConflictError();
  }

  if (code === '23514') {
    throw new MerchantInventoryAdjustmentNegativeInventoryError();
  }

  if (code === '23503') {
    throw new MerchantInventoryAdjustmentVariantNotFoundError();
  }

  if (code === '22023' || code === '22P02' || code === '22003') {
    throw new MerchantInventoryAdjustmentConstraintError();
  }

  throw new MerchantInventoryAdjustmentGatewayUnavailableError();
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof MerchantInventoryAdjustmentGatewayUnavailableError ||
    error instanceof MerchantInventoryAdjustmentDataInvalidError ||
    error instanceof MerchantInventoryAdjustmentConstraintError ||
    error instanceof MerchantInventoryAdjustmentIdempotencyConflictError ||
    error instanceof MerchantInventoryAdjustmentVersionConflictError ||
    error instanceof MerchantInventoryAdjustmentNegativeInventoryError ||
    error instanceof MerchantInventoryAdjustmentVariantNotFoundError
  ) {
    throw error;
  }

  throw new MerchantInventoryAdjustmentGatewayUnavailableError();
}

@Injectable()
export class SupabaseMerchantInventoryAdjustmentGateway implements MerchantInventoryAdjustmentGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async findOwnedVariant(
    client: SupabaseClient,
    variantId: string,
  ): Promise<MerchantOwnedInventoryVariant | null> {
    try {
      const response = await client
        .from('product_variants')
        .select('id, shop_id, is_active')
        .eq('id', variantId)
        .maybeSingle();

      if (response.error !== null) {
        throw new MerchantInventoryAdjustmentGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseNullableOwnedVariant(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async applyAdjustment(
    command: ApplyMerchantInventoryAdjustmentCommand,
  ): Promise<MerchantInventoryAdjustmentSnapshot> {
    try {
      const response = await this.trustedClient.rpc('apply_merchant_inventory_adjustment', {
        p_variant_id: command.variantId,
        p_shop_id: command.shopId,
        p_action: command.action,
        p_quantity: command.quantity,
        p_reason: command.reason,
        p_expected_version: command.expectedVersion,
        p_idempotency_key: command.idempotencyKey,
        p_actor: command.actorId,
      });

      if (response.error !== null) {
        throwForAdjustmentError(response.error);
      }

      const data: unknown = response.data;
      return parseAdjustment(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async listOwnedMovements(
    client: SupabaseClient,
    variantId: string,
    cursor: string | null,
    limit: number,
  ): Promise<MerchantInventoryMovementPage> {
    try {
      const baseQuery = client
        .from('inventory_movements')
        .select(MOVEMENT_SELECT)
        .eq('variant_id', variantId)
        .order('id', { ascending: false });

      const response =
        cursor === null
          ? await baseQuery.limit(limit + 1)
          : await baseQuery.lt('id', cursor).limit(limit + 1);

      if (response.error !== null) {
        throw new MerchantInventoryAdjustmentGatewayUnavailableError();
      }

      const data: unknown = response.data;
      const parsed = parseMovementRows(data);
      const movements = parsed.slice(0, limit);
      const lastMovement = movements.at(-1);

      return {
        movements,
        nextCursor: parsed.length > limit && lastMovement !== undefined ? lastMovement.id : null,
      };
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
