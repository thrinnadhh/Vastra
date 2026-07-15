import type { SupabaseClient } from '../auth/supabase-client.type';
import { Inject, Injectable } from '@nestjs/common';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  MerchantAcceptOrderInput,
  MerchantOrderDecisionResult,
  MerchantRejectOrderInput,
} from './merchant-order-decision.types';
export interface MerchantOrderDecisionGateway {
  accept(
    actorId: string,
    orderId: string,
    input: MerchantAcceptOrderInput,
  ): Promise<MerchantOrderDecisionResult>;
  reject(
    actorId: string,
    orderId: string,
    input: MerchantRejectOrderInput,
  ): Promise<MerchantOrderDecisionResult>;
}
export class MerchantOrderDecisionNotFoundError extends Error {}
export class MerchantOrderDecisionExpiredError extends Error {}
export class MerchantOrderDecisionInvalidStateError extends Error {}
export class MerchantOrderDecisionConflictError extends Error {}
export class MerchantOrderDecisionDataInvalidError extends Error {}
export class MerchantOrderDecisionGatewayUnavailableError extends Error {}
function rec(v: unknown): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    throw new MerchantOrderDecisionDataInvalidError();
  return v as Record<string, unknown>;
}
function str(r: Record<string, unknown>, k: string): string {
  const v = r[k];
  if (typeof v !== 'string' || !v) throw new MerchantOrderDecisionDataInvalidError();
  return v;
}
function nullableStr(r: Record<string, unknown>, k: string): string | null {
  const v = r[k];
  if (v === null) return null;
  if (typeof v !== 'string') throw new MerchantOrderDecisionDataInvalidError();
  return v;
}
function num(r: Record<string, unknown>, k: string): number {
  const v = typeof r[k] === 'string' ? Number(r[k]) : r[k];
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0)
    throw new MerchantOrderDecisionDataInvalidError();
  return v;
}
function bool(r: Record<string, unknown>, k: string): boolean {
  const v = r[k];
  if (typeof v !== 'boolean') throw new MerchantOrderDecisionDataInvalidError();
  return v;
}
function parse(v: unknown): MerchantOrderDecisionResult {
  const r = rec(v);
  const status = r['status'];
  if (status !== 'MERCHANT_ACCEPTED' && status !== 'CANCELLED')
    throw new MerchantOrderDecisionDataInvalidError();
  if (r['alertStatus'] !== 'ACKNOWLEDGED') throw new MerchantOrderDecisionDataInvalidError();
  return {
    orderId: str(r, 'orderId'),
    orderNumber: str(r, 'orderNumber'),
    status,
    alertStatus: 'ACKNOWLEDGED',
    merchantPreparationMinutes:
      r['merchantPreparationMinutes'] === null ? null : num(r, 'merchantPreparationMinutes'),
    acceptedAt: nullableStr(r, 'acceptedAt'),
    cancelledAt: nullableStr(r, 'cancelledAt'),
    cancellationReasonCode: nullableStr(r, 'cancellationReasonCode'),
    cancellationNote: nullableStr(r, 'cancellationNote'),
    reservationsReleased: num(r, 'reservationsReleased'),
    replayed: bool(r, 'replayed'),
  };
}
function mapped(e: { readonly code?: string }): Error {
  switch (e.code) {
    case 'P0017':
      return new MerchantOrderDecisionNotFoundError();
    case 'P0018':
      return new MerchantOrderDecisionExpiredError();
    case 'P0019':
      return new MerchantOrderDecisionInvalidStateError();
    case 'P0020':
      return new MerchantOrderDecisionConflictError();
    case undefined:
      return new MerchantOrderDecisionGatewayUnavailableError();
    default:
      return new MerchantOrderDecisionGatewayUnavailableError();
  }
}
@Injectable()
export class SupabaseMerchantOrderDecisionGateway implements MerchantOrderDecisionGateway {
  public constructor(@Inject(SUPABASE_SERVICE_CLIENT) private readonly client: SupabaseClient) {}
  private async call(
    name: string,
    args: Record<string, unknown>,
  ): Promise<MerchantOrderDecisionResult> {
    try {
      const x = await this.client.rpc(name, args);
      if (x.error !== null) throw mapped(x.error);
      return parse(x.data);
    } catch (e) {
      if (
        e instanceof MerchantOrderDecisionNotFoundError ||
        e instanceof MerchantOrderDecisionExpiredError ||
        e instanceof MerchantOrderDecisionInvalidStateError ||
        e instanceof MerchantOrderDecisionConflictError ||
        e instanceof MerchantOrderDecisionDataInvalidError ||
        e instanceof MerchantOrderDecisionGatewayUnavailableError
      )
        throw e;
      throw new MerchantOrderDecisionGatewayUnavailableError();
    }
  }
  public accept(actorId: string, orderId: string, input: MerchantAcceptOrderInput) {
    return this.call('accept_merchant_order', {
      p_actor: actorId,
      p_order_id: orderId,
      p_preparation_minutes: input.preparationMinutes,
    });
  }
  public reject(actorId: string, orderId: string, input: MerchantRejectOrderInput) {
    return this.call('reject_merchant_order', {
      p_actor: actorId,
      p_order_id: orderId,
      p_reason_code: input.reasonCode,
      p_order_item_id: input.orderItemId,
      p_note: input.note,
    });
  }
}
