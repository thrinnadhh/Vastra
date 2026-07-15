import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import {
  MERCHANT_ORDER_ITEM_FULFILMENT_STATUSES,
  MERCHANT_ORDER_ITEM_VERIFICATION_METHODS,
  MERCHANT_ORDER_ITEM_VERIFICATION_RESULTS,
  MERCHANT_ORDER_PACKING_STATUSES,
  type MerchantOrderItemFulfilmentStatus,
  type MerchantOrderItemVerificationInput,
  type MerchantOrderItemVerificationMethod,
  type MerchantOrderItemVerificationResult,
  type MerchantOrderItemVerificationResultData,
  type MerchantOrderPackingItem,
  type MerchantOrderPackingList,
  type MerchantOrderPackingStatus,
  type MerchantOrderPackingVerification,
  type MerchantOrderStartPackingResult,
} from './merchant-order-packing.types';

export interface MerchantOrderPackingGateway {
  startPacking(actorId: string, orderId: string): Promise<MerchantOrderStartPackingResult>;
  getPackingList(actorId: string, orderId: string): Promise<MerchantOrderPackingList>;
  verifyItem(
    actorId: string,
    orderId: string,
    orderItemId: string,
    input: MerchantOrderItemVerificationInput,
  ): Promise<MerchantOrderItemVerificationResultData>;
}

export class MerchantOrderPackingNotFoundError extends Error {}
export class MerchantOrderPackingInvalidStateError extends Error {}
export class MerchantOrderPackingConflictError extends Error {}
export class MerchantOrderPackingDataInvalidError extends Error {}
export class MerchantOrderPackingGatewayUnavailableError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return value;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return value;
}

function requireUuid(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (!UUID_PATTERN.test(value)) {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return value;
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return value;
}

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const raw = record[key];
  const value = typeof raw === 'string' && raw.trim().length > 0 ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const value = requireNonNegativeInteger(record, key);
  if (value < 1) throw new MerchantOrderPackingDataInvalidError();
  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (Number.isNaN(Date.parse(value))) {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return value;
}

function requireMember<T extends string>(
  record: Record<string, unknown>,
  key: string,
  members: readonly T[],
): T {
  const value = record[key];
  if (typeof value !== 'string' || !members.some((member) => member === value)) {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return value as T;
}

function parsePackingStatus(record: Record<string, unknown>): MerchantOrderPackingStatus {
  return requireMember(record, 'status', MERCHANT_ORDER_PACKING_STATUSES);
}

function parseFulfilmentStatus(record: Record<string, unknown>): MerchantOrderItemFulfilmentStatus {
  return requireMember(record, 'fulfilmentStatus', MERCHANT_ORDER_ITEM_FULFILMENT_STATUSES);
}

function parseMethod(record: Record<string, unknown>): MerchantOrderItemVerificationMethod {
  return requireMember(record, 'method', MERCHANT_ORDER_ITEM_VERIFICATION_METHODS);
}

function parseResult(record: Record<string, unknown>): MerchantOrderItemVerificationResult {
  return requireMember(record, 'result', MERCHANT_ORDER_ITEM_VERIFICATION_RESULTS);
}

function parseVerification(value: unknown): MerchantOrderPackingVerification | null {
  if (value === null) return null;
  const record = requireRecord(value);
  const method = parseMethod(record);
  const result = parseResult(record);
  const scannedBarcode = requireNullableString(record, 'scannedBarcode');
  if (
    (method === 'BARCODE' && scannedBarcode === null) ||
    (method === 'MANUAL' && scannedBarcode !== null)
  ) {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return {
    method,
    result,
    scannedBarcode,
    verifiedAt: requireTimestamp(record, 'verifiedAt'),
  };
}

function parsePackingItem(value: unknown): MerchantOrderPackingItem {
  const record = requireRecord(value);
  return {
    orderItemId: requireUuid(record, 'orderItemId'),
    productName: requireString(record, 'productName'),
    sku: requireString(record, 'sku'),
    colour: requireNullableString(record, 'colour'),
    size: requireNullableString(record, 'size'),
    imageObjectKey: requireNullableString(record, 'imageObjectKey'),
    quantity: requirePositiveInteger(record, 'quantity'),
    fulfilmentStatus: parseFulfilmentStatus(record),
    verification: parseVerification(record['verification']),
  };
}

export function parseStartPackingResult(value: unknown): MerchantOrderStartPackingResult {
  const record = requireRecord(value);
  if (record['status'] !== 'PACKING') {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return {
    orderId: requireUuid(record, 'orderId'),
    orderNumber: requireString(record, 'orderNumber'),
    status: 'PACKING',
    replayed: requireBoolean(record, 'replayed'),
  };
}

export function parsePackingList(value: unknown): MerchantOrderPackingList {
  const record = requireRecord(value);
  const rawItems = record['items'];
  if (!Array.isArray(rawItems)) {
    throw new MerchantOrderPackingDataInvalidError();
  }
  const items = rawItems.map(parsePackingItem);
  const totalLines = requireNonNegativeInteger(record, 'totalLines');
  const verifiedLines = requireNonNegativeInteger(record, 'verifiedLines');
  const allVerified = requireBoolean(record, 'allVerified');
  const calculatedVerified = items.filter(
    (item) =>
      item.fulfilmentStatus === 'VERIFIED' &&
      item.verification !== null &&
      (item.verification.result === 'MATCH' || item.verification.result === 'OVERRIDDEN'),
  ).length;
  if (
    totalLines !== items.length ||
    totalLines < 1 ||
    verifiedLines !== calculatedVerified ||
    allVerified !== (verifiedLines === totalLines)
  ) {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return {
    orderId: requireUuid(record, 'orderId'),
    orderNumber: requireString(record, 'orderNumber'),
    status: parsePackingStatus(record),
    totalLines,
    verifiedLines,
    allVerified,
    items,
  };
}

export function parseItemVerificationResult(
  value: unknown,
): MerchantOrderItemVerificationResultData {
  const record = requireRecord(value);
  const method = parseMethod(record);
  const rawResult = parseResult(record);
  if (rawResult === 'OVERRIDDEN') {
    throw new MerchantOrderPackingDataInvalidError();
  }
  const result: 'MATCH' | 'MISMATCH' = rawResult;
  const fulfilmentStatus = parseFulfilmentStatus(record);
  const scannedBarcode = requireNullableString(record, 'scannedBarcode');
  const verified = requireBoolean(record, 'verified');
  const totalLines = requirePositiveInteger(record, 'totalLines');
  const verifiedLines = requireNonNegativeInteger(record, 'verifiedLines');
  const allVerified = requireBoolean(record, 'allVerified');
  if (
    (method === 'BARCODE' && scannedBarcode === null) ||
    (method === 'MANUAL' && scannedBarcode !== null) ||
    verified !== (result === 'MATCH') ||
    (verified && fulfilmentStatus !== 'VERIFIED') ||
    verifiedLines > totalLines ||
    allVerified !== (verifiedLines === totalLines)
  ) {
    throw new MerchantOrderPackingDataInvalidError();
  }
  return {
    orderId: requireUuid(record, 'orderId'),
    orderItemId: requireUuid(record, 'orderItemId'),
    fulfilmentStatus,
    method,
    result,
    scannedBarcode,
    verified,
    verifiedAt: requireTimestamp(record, 'verifiedAt'),
    totalLines,
    verifiedLines,
    allVerified,
    replayed: requireBoolean(record, 'replayed'),
  };
}

function mapRpcError(error: { readonly code?: string }): Error {
  switch (error.code) {
    case 'P0021':
      return new MerchantOrderPackingNotFoundError();
    case 'P0022':
      return new MerchantOrderPackingInvalidStateError();
    case 'P0023':
      return new MerchantOrderPackingConflictError();
    case undefined:
      return new MerchantOrderPackingGatewayUnavailableError();
    default:
      return new MerchantOrderPackingGatewayUnavailableError();
  }
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof MerchantOrderPackingNotFoundError ||
    error instanceof MerchantOrderPackingInvalidStateError ||
    error instanceof MerchantOrderPackingConflictError ||
    error instanceof MerchantOrderPackingDataInvalidError ||
    error instanceof MerchantOrderPackingGatewayUnavailableError
  ) {
    throw error;
  }
  throw new MerchantOrderPackingGatewayUnavailableError();
}

@Injectable()
export class SupabaseMerchantOrderPackingGateway implements MerchantOrderPackingGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private async call<T>(
    name: string,
    args: Record<string, unknown>,
    parser: (value: unknown) => T,
  ): Promise<T> {
    try {
      const response = await this.client.rpc(name, args);
      if (response.error !== null) {
        throw mapRpcError(response.error);
      }
      return parser(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }

  public startPacking(actorId: string, orderId: string): Promise<MerchantOrderStartPackingResult> {
    return this.call(
      'start_merchant_order_packing',
      { p_actor: actorId, p_order_id: orderId },
      parseStartPackingResult,
    );
  }

  public getPackingList(actorId: string, orderId: string): Promise<MerchantOrderPackingList> {
    return this.call(
      'get_merchant_order_packing_list',
      { p_actor: actorId, p_order_id: orderId },
      parsePackingList,
    );
  }

  public verifyItem(
    actorId: string,
    orderId: string,
    orderItemId: string,
    input: MerchantOrderItemVerificationInput,
  ): Promise<MerchantOrderItemVerificationResultData> {
    return this.call(
      'verify_merchant_order_item',
      {
        p_actor: actorId,
        p_order_id: orderId,
        p_order_item_id: orderItemId,
        p_method: input.method,
        p_barcode: input.method === 'BARCODE' ? input.barcode : null,
      },
      parseItemVerificationResult,
    );
  }
}
