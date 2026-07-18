import { Inject, Injectable } from '@nestjs/common';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { SUPABASE_SERVICE_CLIENT } from '../auth/supabase.tokens';
import type {
  CreateCustomerReturnInput,
  CustomerReturnDetail,
  CustomerReturnEligibility,
} from './customer-return.types';

export interface CustomerReturnGateway {
  getEligibility(actorId: string, orderId: string): Promise<CustomerReturnEligibility | null>;
  create(
    actorId: string,
    orderId: string,
    input: CreateCustomerReturnInput,
  ): Promise<CustomerReturnDetail>;
  get(actorId: string, returnId: string): Promise<CustomerReturnDetail | null>;
}

export class CustomerReturnGatewayUnavailableError extends Error {}
export class CustomerReturnNotEligibleError extends Error {}
export class CustomerReturnQuantityConflictError extends Error {}
export class CustomerReturnIdempotencyConflictError extends Error {}
export class CustomerReturnNotFoundError extends Error {}

function parseRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new CustomerReturnGatewayUnavailableError();
  }
  return value as Readonly<Record<string, unknown>>;
}

@Injectable()
export class SupabaseCustomerReturnGateway implements CustomerReturnGateway {
  public constructor(
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly client: SupabaseClient,
  ) {}

  private mapError(message: string): never {
    if (message.includes('FINANCE_RETURN_NOT_ELIGIBLE')) {
      throw new CustomerReturnNotEligibleError();
    }
    if (message.includes('FINANCE_RETURN_QUANTITY_CONFLICT')) {
      throw new CustomerReturnQuantityConflictError();
    }
    if (message.includes('FINANCE_IDEMPOTENCY_CONFLICT')) {
      throw new CustomerReturnIdempotencyConflictError();
    }
    if (message.includes('FINANCE_RETURN_NOT_FOUND')) {
      throw new CustomerReturnNotFoundError();
    }
    throw new CustomerReturnGatewayUnavailableError();
  }

  public async getEligibility(
    actorId: string,
    orderId: string,
  ): Promise<CustomerReturnEligibility | null> {
    const { data, error } = await this.client.rpc('get_customer_return_eligibility', {
      p_actor_id: actorId,
      p_order_id: orderId,
    });
    if (error !== null) this.mapError(error.message);
    return parseRecord(data);
  }

  public async create(
    actorId: string,
    orderId: string,
    input: CreateCustomerReturnInput,
  ): Promise<CustomerReturnDetail> {
    const { data, error } = await this.client.rpc('create_customer_return_request', {
      p_actor_id: actorId,
      p_order_id: orderId,
      p_items: input.items,
      p_customer_note: input.customerNote,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error !== null) this.mapError(error.message);
    const result = parseRecord(data);
    if (result === null) throw new CustomerReturnGatewayUnavailableError();
    return result;
  }

  public async get(actorId: string, returnId: string): Promise<CustomerReturnDetail | null> {
    const { data, error } = await this.client.rpc('get_customer_return_request', {
      p_actor_id: actorId,
      p_return_id: returnId,
    });
    if (error !== null) this.mapError(error.message);
    return parseRecord(data);
  }
}
