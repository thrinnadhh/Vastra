import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type { StartOrderDispatchInput, StartOrderDispatchResult } from './order-dispatch.types';

export interface OrderDispatchGateway {
  start(input: StartOrderDispatchInput): Promise<StartOrderDispatchResult>;
}

export class OrderDispatchIdempotencyConflictError extends Error {}
export class OrderDispatchNotFoundError extends Error {}
export class OrderDispatchInvalidStateError extends Error {}
export class OrderDispatchIneligibleFulfilmentError extends Error {}
export class OrderDispatchDataInvalidError extends Error {}
export class OrderDispatchGatewayUnavailableError extends Error {}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OrderDispatchDataInvalidError();
  }
  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OrderDispatchDataInvalidError();
  }
  return value;
}

function requireUuid(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key);
  if (!UUID_PATTERN.test(value)) throw new OrderDispatchDataInvalidError();
  return value;
}

export function parseStartOrderDispatchResult(value: unknown): StartOrderDispatchResult {
  const record = requireRecord(value);
  if (
    record['orderStatus'] !== 'CAPTAIN_SEARCHING' ||
    record['deliveryTaskStatus'] !== 'SEARCHING' ||
    record['taskType'] !== 'FORWARD_DELIVERY' ||
    typeof record['replayed'] !== 'boolean'
  ) {
    throw new OrderDispatchDataInvalidError();
  }
  const startedAt = requireString(record, 'startedAt');
  if (Number.isNaN(Date.parse(startedAt))) throw new OrderDispatchDataInvalidError();
  return {
    orderId: requireUuid(record, 'orderId'),
    orderNumber: requireString(record, 'orderNumber'),
    deliveryTaskId: requireUuid(record, 'deliveryTaskId'),
    orderStatus: 'CAPTAIN_SEARCHING',
    deliveryTaskStatus: 'SEARCHING',
    taskType: 'FORWARD_DELIVERY',
    startedAt,
    replayed: record['replayed'],
  };
}

function mapRpcError(error: { readonly code?: string }): Error {
  switch (error.code) {
    case 'P0028':
      return new OrderDispatchIdempotencyConflictError();
    case 'P0029':
      return new OrderDispatchNotFoundError();
    case 'P0030':
      return new OrderDispatchInvalidStateError();
    case 'P0031':
      return new OrderDispatchIneligibleFulfilmentError();
    case 'P0032':
      return new OrderDispatchDataInvalidError();
    case undefined:
      return new OrderDispatchGatewayUnavailableError();
    default:
      return new OrderDispatchGatewayUnavailableError();
  }
}

@Injectable()
export class SupabaseOrderDispatchGateway implements OrderDispatchGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  public async start(input: StartOrderDispatchInput): Promise<StartOrderDispatchResult> {
    try {
      const response = await this.client.rpc('start_order_dispatch', {
        p_order_id: input.orderId,
        p_idempotency_key: input.idempotencyKey,
      });
      if (response.error !== null) throw mapRpcError(response.error);
      return parseStartOrderDispatchResult(response.data);
    } catch (error: unknown) {
      if (
        error instanceof OrderDispatchIdempotencyConflictError ||
        error instanceof OrderDispatchNotFoundError ||
        error instanceof OrderDispatchInvalidStateError ||
        error instanceof OrderDispatchIneligibleFulfilmentError ||
        error instanceof OrderDispatchDataInvalidError ||
        error instanceof OrderDispatchGatewayUnavailableError
      )
        throw error;
      throw new OrderDispatchGatewayUnavailableError();
    }
  }
}
