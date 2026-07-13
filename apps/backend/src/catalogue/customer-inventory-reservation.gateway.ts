import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  MerchantInventoryMovementSnapshot,
  MerchantInventoryMovementType,
  MerchantInventorySourceMethod,
} from './merchant-inventory-adjustment.types';
import type { MerchantInventoryBalanceSnapshot } from './merchant-inventory-balance.types';
import type {
  CreateCustomerInventoryReservationCommand,
  CustomerInventoryReservationSnapshot,
  CustomerInventoryReservationStatus,
  CustomerOwnedCartRecord,
  CustomerOwnedReservationRecord,
  CustomerVisibleVariantRecord,
  ReleaseCustomerInventoryReservationCommand,
} from './customer-inventory-reservation.types';

export interface CustomerInventoryReservationGateway {
  findOwnedActiveCart(
    client: SupabaseClient,
    cartId: string,
  ): Promise<CustomerOwnedCartRecord | null>;

  findVisibleVariant(
    client: SupabaseClient,
    variantId: string,
  ): Promise<CustomerVisibleVariantRecord | null>;

  findOwnedReservation(
    client: SupabaseClient,
    reservationId: string,
  ): Promise<CustomerOwnedReservationRecord | null>;

  createReservation(
    command: CreateCustomerInventoryReservationCommand,
  ): Promise<CustomerInventoryReservationSnapshot>;

  releaseReservation(
    command: ReleaseCustomerInventoryReservationCommand,
  ): Promise<CustomerInventoryReservationSnapshot>;
}

export class CustomerInventoryReservationGatewayUnavailableError extends Error {
  public constructor() {
    super('Customer inventory reservation provider unavailable');
    this.name = 'CustomerInventoryReservationGatewayUnavailableError';
  }
}

export class CustomerInventoryReservationDataInvalidError extends Error {
  public constructor() {
    super('Customer inventory reservation data invalid');
    this.name = 'CustomerInventoryReservationDataInvalidError';
  }
}

export class CustomerInventoryReservationConstraintError extends Error {
  public constructor() {
    super('Customer inventory reservation violates a database constraint');
    this.name = 'CustomerInventoryReservationConstraintError';
  }
}

export class CustomerInventoryReservationIdempotencyConflictError extends Error {
  public constructor() {
    super('Customer inventory reservation idempotency key conflicts');
    this.name = 'CustomerInventoryReservationIdempotencyConflictError';
  }
}

export class CustomerInventoryReservationInsufficientInventoryError extends Error {
  public constructor() {
    super('Customer inventory reservation has insufficient inventory');
    this.name = 'CustomerInventoryReservationInsufficientInventoryError';
  }
}

export class CustomerInventoryReservationConflictError extends Error {
  public constructor() {
    super('Customer inventory reservation conflicts with current state');
    this.name = 'CustomerInventoryReservationConflictError';
  }
}

export class CustomerInventoryReservationNotFoundError extends Error {
  public constructor() {
    super('Customer inventory reservation was not found');
    this.name = 'CustomerInventoryReservationNotFoundError';
  }
}

const RESERVATION_STATUSES = new Set<CustomerInventoryReservationStatus>([
  'ACTIVE',
  'CONVERTED',
  'RELEASED',
  'EXPIRED',
]);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new CustomerInventoryReservationDataInvalidError();
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
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return value;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = requireInteger(record, key);

  if (value < 0) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireInteger(record, key);

  if (value <= 0) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return value;
}

function requireReservationStatus(
  record: Record<string, unknown>,
  key: string,
): CustomerInventoryReservationStatus {
  const value = record[key];

  if (
    typeof value !== 'string' ||
    !RESERVATION_STATUSES.has(value as CustomerInventoryReservationStatus)
  ) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return value as CustomerInventoryReservationStatus;
}

function requireMovementType(
  record: Record<string, unknown>,
  key: string,
): MerchantInventoryMovementType {
  const value = record[key];

  if (typeof value !== 'string' || !MOVEMENT_TYPES.has(value as MerchantInventoryMovementType)) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return value as MerchantInventoryMovementType;
}

function requireSourceMethod(
  record: Record<string, unknown>,
  key: string,
): MerchantInventorySourceMethod {
  const value = record[key];

  if (typeof value !== 'string' || !SOURCE_METHODS.has(value as MerchantInventorySourceMethod)) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return value as MerchantInventorySourceMethod;
}

function parseOwnedCart(value: unknown): CustomerOwnedCartRecord {
  if (!isRecord(value)) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    shopId: requireString(value, 'shop_id'),
    status: requireString(value, 'status'),
  };
}

function parseNullableOwnedCart(value: unknown): CustomerOwnedCartRecord | null {
  return value === null ? null : parseOwnedCart(value);
}

function parseVisibleVariant(value: unknown): CustomerVisibleVariantRecord {
  if (!isRecord(value)) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    shopId: requireString(value, 'shop_id'),
    isActive: requireBoolean(value, 'is_active'),
  };
}

function parseNullableVisibleVariant(value: unknown): CustomerVisibleVariantRecord | null {
  return value === null ? null : parseVisibleVariant(value);
}

function parseOwnedReservation(value: unknown): CustomerOwnedReservationRecord {
  if (!isRecord(value)) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  const cartId = requireNullableString(value, 'cart_id');

  if (cartId === null) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    shopId: requireString(value, 'shop_id'),
    variantId: requireString(value, 'variant_id'),
    cartId,
    status: requireReservationStatus(value, 'status'),
  };
}

function parseNullableOwnedReservation(value: unknown): CustomerOwnedReservationRecord | null {
  return value === null ? null : parseOwnedReservation(value);
}

function parseMovement(value: unknown): MerchantInventoryMovementSnapshot {
  if (!isRecord(value)) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  const rawId = value['id'];
  const id =
    typeof rawId === 'string'
      ? rawId
      : typeof rawId === 'number' && Number.isSafeInteger(rawId)
        ? String(rawId)
        : null;

  if (id === null || !/^[1-9][0-9]*$/u.test(id)) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return {
    id,
    shopId: requireString(value, 'shopId'),
    variantId: requireString(value, 'variantId'),
    movementType: requireMovementType(value, 'movementType'),
    quantityChange: requireInteger(value, 'quantityChange'),
    reservedChange: requireInteger(value, 'reservedChange'),
    damagedChange: requireInteger(value, 'damagedChange'),
    stockBefore: requireNonNegativeInteger(value, 'stockBefore'),
    stockAfter: requireNonNegativeInteger(value, 'stockAfter'),
    reservedBefore: requireNonNegativeInteger(value, 'reservedBefore'),
    reservedAfter: requireNonNegativeInteger(value, 'reservedAfter'),
    damagedBefore: requireNonNegativeInteger(value, 'damagedBefore'),
    damagedAfter: requireNonNegativeInteger(value, 'damagedAfter'),
    referenceType: requireNullableString(value, 'referenceType'),
    referenceId: requireNullableString(value, 'referenceId'),
    reason: requireNullableString(value, 'reason'),
    performedBy: requireNullableString(value, 'performedBy'),
    sourceMethod: requireSourceMethod(value, 'sourceMethod'),
    createdAt: requireString(value, 'createdAt'),
  };
}

function parseBalance(value: unknown): MerchantInventoryBalanceSnapshot {
  if (!isRecord(value)) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  const stockOnHand = requireNonNegativeInteger(value, 'stockOnHand');
  const reservedQuantity = requireNonNegativeInteger(value, 'reservedQuantity');
  const damagedQuantity = requireNonNegativeInteger(value, 'damagedQuantity');
  const availableQuantity = requireNonNegativeInteger(value, 'availableQuantity');

  if (availableQuantity !== stockOnHand - reservedQuantity - damagedQuantity) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return {
    persisted: requireBoolean(value, 'persisted'),
    stockOnHand,
    reservedQuantity,
    damagedQuantity,
    availableQuantity,
    reorderLevel: requireNonNegativeInteger(value, 'reorderLevel'),
    version: requirePositiveInteger(value, 'version'),
    lastCountedAt: requireNullableString(value, 'lastCountedAt'),
    updatedAt: requireNullableString(value, 'updatedAt'),
  };
}

function parseReservation(value: unknown): CustomerInventoryReservationSnapshot {
  if (!isRecord(value)) {
    throw new CustomerInventoryReservationDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    idempotencyKey: requireNullableString(value, 'idempotencyKey'),
    replayed: requireBoolean(value, 'replayed'),
    shopId: requireString(value, 'shopId'),
    variantId: requireString(value, 'variantId'),
    cartId: requireString(value, 'cartId'),
    quantity: requirePositiveInteger(value, 'quantity'),
    status: requireReservationStatus(value, 'status'),
    expiresAt: requireString(value, 'expiresAt'),
    createdAt: requireString(value, 'createdAt'),
    releasedAt: requireNullableString(value, 'releasedAt'),
    movement: parseMovement(value['movement']),
    balance: parseBalance(value['balance']),
  };
}

function readPostgresCode(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const code = value['code'];
  return typeof code === 'string' ? code : null;
}

function throwForWriteError(error: unknown): never {
  const code = readPostgresCode(error);

  if (code === 'P0001') {
    throw new CustomerInventoryReservationInsufficientInventoryError();
  }

  if (code === 'P0002') {
    throw new CustomerInventoryReservationIdempotencyConflictError();
  }

  if (code === '23503') {
    throw new CustomerInventoryReservationNotFoundError();
  }

  if (code === '23505' || code === '55000') {
    throw new CustomerInventoryReservationConflictError();
  }

  if (code === '22023' || code === '22P02' || code === '22003') {
    throw new CustomerInventoryReservationConstraintError();
  }

  throw new CustomerInventoryReservationGatewayUnavailableError();
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof CustomerInventoryReservationGatewayUnavailableError ||
    error instanceof CustomerInventoryReservationDataInvalidError ||
    error instanceof CustomerInventoryReservationConstraintError ||
    error instanceof CustomerInventoryReservationIdempotencyConflictError ||
    error instanceof CustomerInventoryReservationInsufficientInventoryError ||
    error instanceof CustomerInventoryReservationConflictError ||
    error instanceof CustomerInventoryReservationNotFoundError
  ) {
    throw error;
  }

  throw new CustomerInventoryReservationGatewayUnavailableError();
}

@Injectable()
export class SupabaseCustomerInventoryReservationGateway implements CustomerInventoryReservationGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async findOwnedActiveCart(
    client: SupabaseClient,
    cartId: string,
  ): Promise<CustomerOwnedCartRecord | null> {
    try {
      const response = await client
        .from('carts')
        .select('id, shop_id, status')
        .eq('id', cartId)
        .maybeSingle();

      if (response.error !== null) {
        throw new CustomerInventoryReservationGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseNullableOwnedCart(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findVisibleVariant(
    client: SupabaseClient,
    variantId: string,
  ): Promise<CustomerVisibleVariantRecord | null> {
    try {
      const response = await client
        .from('product_variants')
        .select('id, shop_id, is_active')
        .eq('id', variantId)
        .maybeSingle();

      if (response.error !== null) {
        throw new CustomerInventoryReservationGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseNullableVisibleVariant(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async findOwnedReservation(
    client: SupabaseClient,
    reservationId: string,
  ): Promise<CustomerOwnedReservationRecord | null> {
    try {
      const response = await client
        .from('inventory_reservations')
        .select('id, shop_id, variant_id, cart_id, status')
        .eq('id', reservationId)
        .maybeSingle();

      if (response.error !== null) {
        throw new CustomerInventoryReservationGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parseNullableOwnedReservation(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async createReservation(
    command: CreateCustomerInventoryReservationCommand,
  ): Promise<CustomerInventoryReservationSnapshot> {
    try {
      const response = await this.trustedClient.rpc('create_customer_cart_reservation', {
        p_cart_id: command.cartId,
        p_variant_id: command.variantId,
        p_quantity: command.quantity,
        p_ttl_seconds: command.ttlSeconds,
        p_idempotency_key: command.idempotencyKey,
        p_actor: command.actorId,
      });

      if (response.error !== null) {
        throwForWriteError(response.error);
      }

      const data: unknown = response.data;
      return parseReservation(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public async releaseReservation(
    command: ReleaseCustomerInventoryReservationCommand,
  ): Promise<CustomerInventoryReservationSnapshot> {
    try {
      const response = await this.trustedClient.rpc('release_customer_cart_reservation', {
        p_reservation_id: command.reservationId,
        p_reason: command.reason,
        p_actor: command.actorId,
      });

      if (response.error !== null) {
        throwForWriteError(response.error);
      }

      const data: unknown = response.data;
      return parseReservation(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
