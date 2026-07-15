import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { MerchantOrderReadyResult } from './merchant-order-ready.types';

export interface MerchantOrderReadyGateway {
  markReady(
    actorId: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<MerchantOrderReadyResult>;
}

export class MerchantOrderReadyNotFoundError extends Error {}
export class MerchantOrderReadyInvalidStateError extends Error {}
export class MerchantOrderReadyItemNotVerifiedError extends Error {}
export class MerchantOrderReadyDataInvalidError extends Error {}
export class MerchantOrderReadyGatewayUnavailableError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MerchantOrderReadyDataInvalidError();
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerchantOrderReadyDataInvalidError();
  }
  return value;
}

function requireUuid(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (!UUID_PATTERN.test(value)) throw new MerchantOrderReadyDataInvalidError();
  return value;
}

function requirePositiveInteger(record: Record<string, unknown>, key: string): number {
  const raw = record[key];
  const value = typeof raw === 'string' && raw.trim().length > 0 ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new MerchantOrderReadyDataInvalidError();
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw new MerchantOrderReadyDataInvalidError();
  return value;
}

function requireTimestamp(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (Number.isNaN(Date.parse(value))) throw new MerchantOrderReadyDataInvalidError();
  return value;
}

export function parseMerchantOrderReadyResult(value: unknown): MerchantOrderReadyResult {
  const record = requireRecord(value);
  if (record['status'] !== 'READY_FOR_PICKUP') {
    throw new MerchantOrderReadyDataInvalidError();
  }
  const totalLines = requirePositiveInteger(record, 'totalLines');
  const packedLines = requirePositiveInteger(record, 'packedLines');
  const allPacked = requireBoolean(record, 'allPacked');
  if (packedLines !== totalLines || !allPacked) {
    throw new MerchantOrderReadyDataInvalidError();
  }
  return {
    orderId: requireUuid(record, 'orderId'),
    orderNumber: requireString(record, 'orderNumber'),
    status: 'READY_FOR_PICKUP',
    readyAt: requireTimestamp(record, 'readyAt'),
    totalLines,
    packedLines,
    allPacked: true,
    replayed: requireBoolean(record, 'replayed'),
  };
}

function mapRpcError(error: { readonly code?: string }): Error {
  switch (error.code) {
    case 'P0024':
      return new MerchantOrderReadyNotFoundError();
    case 'P0025':
      return new MerchantOrderReadyInvalidStateError();
    case 'P0026':
      return new MerchantOrderReadyItemNotVerifiedError();
    case 'P0027':
      return new MerchantOrderReadyDataInvalidError();
    case undefined:
      return new MerchantOrderReadyGatewayUnavailableError();
    default:
      return new MerchantOrderReadyGatewayUnavailableError();
  }
}

@Injectable()
export class SupabaseMerchantOrderReadyGateway implements MerchantOrderReadyGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async markReady(
    actorId: string,
    orderId: string,
    idempotencyKey: string,
  ): Promise<MerchantOrderReadyResult> {
    try {
      const response = await this.client.rpc('mark_merchant_order_ready_for_pickup', {
        p_actor: actorId,
        p_order_id: orderId,
        p_idempotency_key: idempotencyKey,
      });
      if (response.error !== null) throw mapRpcError(response.error);
      return parseMerchantOrderReadyResult(response.data);
    } catch (error: unknown) {
      if (
        error instanceof MerchantOrderReadyNotFoundError ||
        error instanceof MerchantOrderReadyInvalidStateError ||
        error instanceof MerchantOrderReadyItemNotVerifiedError ||
        error instanceof MerchantOrderReadyDataInvalidError ||
        error instanceof MerchantOrderReadyGatewayUnavailableError
      ) {
        throw error;
      }
      throw new MerchantOrderReadyGatewayUnavailableError();
    }
  }
}
