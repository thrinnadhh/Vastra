import { Injectable } from '@nestjs/common';
import type { SupabaseClient } from '../auth/supabase-client.type';
import type {
  CreateCustomerAddressInput,
  CustomerAddressSnapshot,
  UpdateCustomerAddressInput,
} from './customer-address.types';

export interface CustomerAddressGateway {
  list(client: SupabaseClient): Promise<readonly CustomerAddressSnapshot[]>;
  create(
    client: SupabaseClient,
    input: CreateCustomerAddressInput,
    key: string,
  ): Promise<CustomerAddressSnapshot>;
  get(client: SupabaseClient, addressId: string): Promise<CustomerAddressSnapshot>;
  update(
    client: SupabaseClient,
    addressId: string,
    input: UpdateCustomerAddressInput,
    key: string,
  ): Promise<CustomerAddressSnapshot>;
  remove(
    client: SupabaseClient,
    addressId: string,
    key: string,
  ): Promise<{ deletedAddressId: string; defaultAddressId: string | null }>;
  setDefault(
    client: SupabaseClient,
    addressId: string,
    key: string,
  ): Promise<CustomerAddressSnapshot>;
}

export class CustomerAddressNotFoundError extends Error {}
export class CustomerAddressConflictError extends Error {}
export class CustomerAddressProviderUnavailableError extends Error {}
export class CustomerAddressDataInvalidError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function requiredString(value: Record<string, unknown>, key: string): string {
  const result = value[key];
  if (typeof result !== 'string' || result.length === 0)
    throw new CustomerAddressDataInvalidError();
  return result;
}
function nullableString(value: Record<string, unknown>, key: string): string | null {
  const result = value[key];
  if (result === null) return null;
  if (typeof result !== 'string') throw new CustomerAddressDataInvalidError();
  return result;
}
function requiredNumber(value: Record<string, unknown>, key: string): number {
  const result = value[key];
  if (typeof result !== 'number' || !Number.isFinite(result))
    throw new CustomerAddressDataInvalidError();
  return result;
}
function requiredBoolean(value: Record<string, unknown>, key: string): boolean {
  const result = value[key];
  if (typeof result !== 'boolean') throw new CustomerAddressDataInvalidError();
  return result;
}
function parseAddress(value: unknown): CustomerAddressSnapshot {
  if (!isRecord(value)) throw new CustomerAddressDataInvalidError();
  return {
    id: requiredString(value, 'id'),
    label: nullableString(value, 'label'),
    recipientName: requiredString(value, 'recipientName'),
    phoneNumber: requiredString(value, 'phoneNumber'),
    line1: requiredString(value, 'line1'),
    line2: nullableString(value, 'line2'),
    landmark: nullableString(value, 'landmark'),
    area: requiredString(value, 'area'),
    city: requiredString(value, 'city'),
    state: requiredString(value, 'state'),
    postalCode: requiredString(value, 'postalCode'),
    countryCode: requiredString(value, 'countryCode'),
    latitude: requiredNumber(value, 'latitude'),
    longitude: requiredNumber(value, 'longitude'),
    isDefault: requiredBoolean(value, 'isDefault'),
    serviceable: requiredBoolean(value, 'serviceable'),
    createdAt: requiredString(value, 'createdAt'),
    updatedAt: requiredString(value, 'updatedAt'),
  };
}
function firstField(data: unknown, key: string): unknown {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0]))
    throw new CustomerAddressDataInvalidError();
  return data[0][key];
}
function mapError(error: { readonly code?: string } | null): never {
  if (error?.code === 'P0002') throw new CustomerAddressNotFoundError();
  if (error?.code === '23505' || error?.code === 'P0001') throw new CustomerAddressConflictError();
  throw new CustomerAddressProviderUnavailableError();
}
function payload(
  input: CreateCustomerAddressInput | UpdateCustomerAddressInput,
): Record<string, unknown> {
  return { ...input };
}

@Injectable()
export class SupabaseCustomerAddressGateway implements CustomerAddressGateway {
  public async list(client: SupabaseClient): Promise<readonly CustomerAddressSnapshot[]> {
    const response = await client.rpc('list_customer_addresses', {});
    if (response.error !== null) mapError(response.error);
    if (!Array.isArray(response.data)) throw new CustomerAddressDataInvalidError();
    return response.data.map((row) => {
      if (!isRecord(row)) throw new CustomerAddressDataInvalidError();
      return parseAddress(row['address']);
    });
  }
  public async create(
    client: SupabaseClient,
    input: CreateCustomerAddressInput,
    key: string,
  ): Promise<CustomerAddressSnapshot> {
    const response = await client.rpc('create_customer_address', {
      p_payload: payload(input),
      p_idempotency_key: key,
    });
    if (response.error !== null) mapError(response.error);
    return parseAddress(firstField(response.data, 'address'));
  }
  public async get(client: SupabaseClient, addressId: string): Promise<CustomerAddressSnapshot> {
    const response = await client.rpc('get_customer_address', { p_address_id: addressId });
    if (response.error !== null) mapError(response.error);
    return parseAddress(firstField(response.data, 'address'));
  }
  public async update(
    client: SupabaseClient,
    addressId: string,
    input: UpdateCustomerAddressInput,
    key: string,
  ): Promise<CustomerAddressSnapshot> {
    const response = await client.rpc('update_customer_address', {
      p_address_id: addressId,
      p_payload: payload(input),
      p_idempotency_key: key,
    });
    if (response.error !== null) mapError(response.error);
    return parseAddress(firstField(response.data, 'address'));
  }
  public async remove(
    client: SupabaseClient,
    addressId: string,
    key: string,
  ): Promise<{ deletedAddressId: string; defaultAddressId: string | null }> {
    const response = await client.rpc('delete_customer_address', {
      p_address_id: addressId,
      p_idempotency_key: key,
    });
    if (response.error !== null) mapError(response.error);
    const result = firstField(response.data, 'result');
    if (!isRecord(result)) throw new CustomerAddressDataInvalidError();
    return {
      deletedAddressId: requiredString(result, 'deletedAddressId'),
      defaultAddressId: nullableString(result, 'defaultAddressId'),
    };
  }
  public async setDefault(
    client: SupabaseClient,
    addressId: string,
    key: string,
  ): Promise<CustomerAddressSnapshot> {
    const response = await client.rpc('set_customer_default_address', {
      p_address_id: addressId,
      p_idempotency_key: key,
    });
    if (response.error !== null) mapError(response.error);
    return parseAddress(firstField(response.data, 'address'));
  }
}
