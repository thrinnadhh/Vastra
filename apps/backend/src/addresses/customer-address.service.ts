import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CUSTOMER_ADDRESS_GATEWAY } from './customer-address.tokens';
import {
  CustomerAddressConflictError,
  CustomerAddressDataInvalidError,
  type CustomerAddressGateway,
  CustomerAddressNotFoundError,
  CustomerAddressProviderUnavailableError,
} from './customer-address.gateway';
import type {
  CustomerAddressResponse,
  DeleteCustomerAddressResponse,
  ListCustomerAddressesResponse,
} from './customer-address.types';
import {
  CustomerAddressValidationError,
  parseAddressIdempotencyKey,
  parseCreateCustomerAddress,
  parseCustomerAddressId,
  parseUpdateCustomerAddress,
} from './customer-address.validation';

function exception(
  status: number,
  code: string,
  message: string,
  retryable = false,
): HttpException {
  return new HttpException(
    { success: false, error: { code, message, details: null, retryable }, requestId: null },
    status,
  );
}

@Injectable()
export class CustomerAddressService {
  public constructor(
    @Inject(CUSTOMER_ADDRESS_GATEWAY) private readonly gateway: CustomerAddressGateway,
  ) {}
  public async list(context: AuthenticatedRequestContext): Promise<ListCustomerAddressesResponse> {
    try {
      return {
        success: true,
        data: { addresses: await this.gateway.list(context.supabase) },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrow(error);
    }
  }
  public async create(
    context: AuthenticatedRequestContext,
    body: unknown,
    keyValue: unknown,
  ): Promise<CustomerAddressResponse> {
    try {
      const input = parseCreateCustomerAddress(body);
      const key = parseAddressIdempotencyKey(keyValue);
      return {
        success: true,
        data: { address: await this.gateway.create(context.supabase, input, key) },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrow(error);
    }
  }
  public async get(
    context: AuthenticatedRequestContext,
    idValue: unknown,
  ): Promise<CustomerAddressResponse> {
    try {
      const id = parseCustomerAddressId(idValue);
      return {
        success: true,
        data: { address: await this.gateway.get(context.supabase, id) },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrow(error);
    }
  }
  public async update(
    context: AuthenticatedRequestContext,
    idValue: unknown,
    body: unknown,
    keyValue: unknown,
  ): Promise<CustomerAddressResponse> {
    try {
      const id = parseCustomerAddressId(idValue);
      const input = parseUpdateCustomerAddress(body);
      const key = parseAddressIdempotencyKey(keyValue);
      return {
        success: true,
        data: { address: await this.gateway.update(context.supabase, id, input, key) },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrow(error);
    }
  }
  public async remove(
    context: AuthenticatedRequestContext,
    idValue: unknown,
    keyValue: unknown,
  ): Promise<DeleteCustomerAddressResponse> {
    try {
      const id = parseCustomerAddressId(idValue);
      const key = parseAddressIdempotencyKey(keyValue);
      const result = await this.gateway.remove(context.supabase, id, key);
      return { success: true, data: result, meta: { requestId: null } };
    } catch (error: unknown) {
      return this.rethrow(error);
    }
  }
  public async setDefault(
    context: AuthenticatedRequestContext,
    idValue: unknown,
    keyValue: unknown,
  ): Promise<CustomerAddressResponse> {
    try {
      const id = parseCustomerAddressId(idValue);
      const key = parseAddressIdempotencyKey(keyValue);
      return {
        success: true,
        data: { address: await this.gateway.setDefault(context.supabase, id, key) },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrow(error);
    }
  }
  private rethrow(error: unknown): never {
    if (error instanceof CustomerAddressValidationError)
      throw exception(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'Customer address request is invalid.',
      );
    if (error instanceof CustomerAddressNotFoundError)
      throw exception(HttpStatus.NOT_FOUND, 'CUSTOMER_ADDRESS_NOT_FOUND', 'Address was not found.');
    if (error instanceof CustomerAddressConflictError)
      throw exception(
        HttpStatus.CONFLICT,
        'CUSTOMER_ADDRESS_CONFLICT',
        'Address state or idempotency key conflicts with this request.',
      );
    if (error instanceof CustomerAddressProviderUnavailableError)
      throw exception(
        HttpStatus.SERVICE_UNAVAILABLE,
        'ADDRESS_PROVIDER_UNAVAILABLE',
        'Address service is temporarily unavailable.',
        true,
      );
    if (error instanceof CustomerAddressDataInvalidError)
      throw exception(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'ADDRESS_STATE_INVALID',
        'Address service returned invalid state.',
      );
    throw error;
  }
}
