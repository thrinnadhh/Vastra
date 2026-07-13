import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { MerchantInventoryBalanceSnapshot } from './merchant-inventory-balance.types';
import type {
  CreateMerchantOfflineSaleCommand,
  MerchantOfflineSaleIdentificationMethod,
  MerchantOfflineSaleItemSnapshot,
  MerchantOfflineSalePaymentMethod,
  MerchantOfflineSaleSnapshot,
} from './merchant-offline-sale.types';

export interface MerchantOfflineSaleGateway {
  createOfflineSale(
    command: CreateMerchantOfflineSaleCommand,
  ): Promise<MerchantOfflineSaleSnapshot>;
}

export class MerchantOfflineSaleGatewayUnavailableError extends Error {
  public constructor() {
    super('Merchant offline sale provider unavailable');
    this.name = 'MerchantOfflineSaleGatewayUnavailableError';
  }
}

export class MerchantOfflineSaleDataInvalidError extends Error {
  public constructor() {
    super('Merchant offline sale data invalid');
    this.name = 'MerchantOfflineSaleDataInvalidError';
  }
}

export class MerchantOfflineSaleConstraintError extends Error {
  public constructor() {
    super('Merchant offline sale violates a database constraint');
    this.name = 'MerchantOfflineSaleConstraintError';
  }
}

export class MerchantOfflineSaleIdempotencyConflictError extends Error {
  public constructor() {
    super('Merchant offline sale idempotency key conflicts');
    this.name = 'MerchantOfflineSaleIdempotencyConflictError';
  }
}

export class MerchantOfflineSaleInsufficientInventoryError extends Error {
  public constructor() {
    super('Merchant offline sale has insufficient inventory');
    this.name = 'MerchantOfflineSaleInsufficientInventoryError';
  }
}

export class MerchantOfflineSaleVariantNotFoundError extends Error {
  public constructor() {
    super('Merchant offline sale variant not found');
    this.name = 'MerchantOfflineSaleVariantNotFoundError';
  }
}

const PAYMENT_METHODS = new Set<MerchantOfflineSalePaymentMethod>(['CASH', 'UPI', 'CARD', 'OTHER']);

const IDENTIFICATION_METHODS = new Set<MerchantOfflineSaleIdentificationMethod>([
  'BARCODE',
  'MANUAL_SEARCH',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new MerchantOfflineSaleDataInvalidError();
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
    throw new MerchantOfflineSaleDataInvalidError();
  }

  return value;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = requireInteger(record, key);

  if (value < 0) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireInteger(record, key);

  if (value <= 0) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  return value;
}

function requirePaymentMethod(
  record: Record<string, unknown>,
  key: string,
): MerchantOfflineSalePaymentMethod {
  const value = record[key];

  if (
    typeof value !== 'string' ||
    !PAYMENT_METHODS.has(value as MerchantOfflineSalePaymentMethod)
  ) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  return value as MerchantOfflineSalePaymentMethod;
}

function requireIdentificationMethod(
  record: Record<string, unknown>,
  key: string,
): MerchantOfflineSaleIdentificationMethod {
  const value = record[key];

  if (
    typeof value !== 'string' ||
    !IDENTIFICATION_METHODS.has(value as MerchantOfflineSaleIdentificationMethod)
  ) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  return value as MerchantOfflineSaleIdentificationMethod;
}

function parseBalance(value: unknown): MerchantInventoryBalanceSnapshot {
  if (!isRecord(value)) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  const stockOnHand = requireNonNegativeInteger(value, 'stockOnHand');
  const reservedQuantity = requireNonNegativeInteger(value, 'reservedQuantity');
  const damagedQuantity = requireNonNegativeInteger(value, 'damagedQuantity');
  const availableQuantity = requireNonNegativeInteger(value, 'availableQuantity');
  const version = requirePositiveInteger(value, 'version');

  if (availableQuantity !== stockOnHand - reservedQuantity - damagedQuantity) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  return {
    persisted: requireBoolean(value, 'persisted'),
    stockOnHand,
    reservedQuantity,
    damagedQuantity,
    availableQuantity,
    reorderLevel: requireNonNegativeInteger(value, 'reorderLevel'),
    version,
    lastCountedAt: requireNullableString(value, 'lastCountedAt'),
    updatedAt: requireNullableString(value, 'updatedAt'),
  };
}

function parseItem(value: unknown): MerchantOfflineSaleItemSnapshot {
  if (!isRecord(value)) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  const movementId = requireString(value, 'movementId');

  if (!/^[1-9][0-9]*$/u.test(movementId)) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    variantId: requireString(value, 'variantId'),
    quantity: requirePositiveInteger(value, 'quantity'),
    unitPricePaise: requireNonNegativeInteger(value, 'unitPricePaise'),
    discountPaise: requireNonNegativeInteger(value, 'discountPaise'),
    totalPaise: requireNonNegativeInteger(value, 'totalPaise'),
    identificationMethod: requireIdentificationMethod(value, 'identificationMethod'),
    movementId,
    balance: parseBalance(value['balance']),
  };
}

function parseItems(value: unknown): readonly MerchantOfflineSaleItemSnapshot[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  return value.map((item) => parseItem(item));
}

function parseSale(value: unknown): MerchantOfflineSaleSnapshot {
  if (!isRecord(value)) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  const status = value['status'];

  if (status !== 'COMPLETED') {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  const subtotalPaise = requireNonNegativeInteger(value, 'subtotalPaise');
  const discountPaise = requireNonNegativeInteger(value, 'discountPaise');
  const taxPaise = requireNonNegativeInteger(value, 'taxPaise');
  const totalPaise = requireNonNegativeInteger(value, 'totalPaise');

  if (discountPaise > subtotalPaise || totalPaise !== subtotalPaise - discountPaise + taxPaise) {
    throw new MerchantOfflineSaleDataInvalidError();
  }

  return {
    id: requireString(value, 'id'),
    saleNumber: requireString(value, 'saleNumber'),
    idempotencyKey: requireString(value, 'idempotencyKey'),
    replayed: requireBoolean(value, 'replayed'),
    shopId: requireString(value, 'shopId'),
    merchantId: requireString(value, 'merchantId'),
    customerPhone: requireNullableString(value, 'customerPhone'),
    subtotalPaise,
    discountPaise,
    taxPaise,
    totalPaise,
    paymentMethod: requirePaymentMethod(value, 'paymentMethod'),
    status,
    recordedBy: requireString(value, 'recordedBy'),
    createdAt: requireString(value, 'createdAt'),
    items: parseItems(value['items']),
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

  if (code === 'P0002') {
    throw new MerchantOfflineSaleIdempotencyConflictError();
  }

  if (code === '23514') {
    throw new MerchantOfflineSaleInsufficientInventoryError();
  }

  if (code === '23503') {
    throw new MerchantOfflineSaleVariantNotFoundError();
  }

  if (code === '22023' || code === '22P02' || code === '22003') {
    throw new MerchantOfflineSaleConstraintError();
  }

  throw new MerchantOfflineSaleGatewayUnavailableError();
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof MerchantOfflineSaleGatewayUnavailableError ||
    error instanceof MerchantOfflineSaleDataInvalidError ||
    error instanceof MerchantOfflineSaleConstraintError ||
    error instanceof MerchantOfflineSaleIdempotencyConflictError ||
    error instanceof MerchantOfflineSaleInsufficientInventoryError ||
    error instanceof MerchantOfflineSaleVariantNotFoundError
  ) {
    throw error;
  }

  throw new MerchantOfflineSaleGatewayUnavailableError();
}

@Injectable()
export class SupabaseMerchantOfflineSaleGateway implements MerchantOfflineSaleGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly trustedClient: SupabaseClient,
  ) {}

  public async createOfflineSale(
    command: CreateMerchantOfflineSaleCommand,
  ): Promise<MerchantOfflineSaleSnapshot> {
    try {
      const response = await this.trustedClient.rpc('create_merchant_offline_sale', {
        p_shop_id: command.shopId,
        p_customer_phone: command.customerPhone,
        p_tax_paise: command.taxPaise,
        p_payment_method: command.paymentMethod,
        p_items: command.items,
        p_idempotency_key: command.idempotencyKey,
        p_actor: command.actorId,
      });

      if (response.error !== null) {
        throwForWriteError(response.error);
      }

      const data: unknown = response.data;
      return parseSale(data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
