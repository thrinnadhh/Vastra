import type { ApiClient } from '@vastra/api-client';

import type {
  CustomerAddress,
  CustomerAddressFailure,
  CustomerAddressFieldErrors,
  CustomerAddressListResult,
  CustomerAddressMutationResult,
  CustomerAddressPort,
  DeleteCustomerAddressResult,
  SaveCustomerAddressInput,
} from './customer-address.types';

interface ApiAddress {
  readonly id: string;
  readonly label: string | null;
  readonly recipientName: string;
  readonly phoneNumber: string;
  readonly line1: string;
  readonly line2: string | null;
  readonly landmark: string | null;
  readonly area: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode: 'IN';
  readonly latitude: number;
  readonly longitude: number;
  readonly isDefault: boolean;
  readonly serviceable: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ListResponse {
  readonly data: Readonly<{ readonly addresses: readonly ApiAddress[] }>;
}
interface AddressResponse {
  readonly data: Readonly<{ readonly address: ApiAddress }>;
}
interface DeleteResponse {
  readonly data: Readonly<{
    readonly deletedAddressId: string;
    readonly defaultAddressId: string | null;
  }>;
}

const FIELD_NAMES = [
  'label',
  'recipientName',
  'phoneNumber',
  'line1',
  'line2',
  'landmark',
  'area',
  'city',
  'state',
  'postalCode',
  'latitude',
  'longitude',
  'isDefault',
] as const;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function mapAddress(address: ApiAddress): CustomerAddress {
  return {
    id: address.id,
    label: address.label,
    recipientName: address.recipientName,
    phoneNumber: address.phoneNumber,
    line1: address.line1,
    line2: address.line2,
    landmark: address.landmark,
    area: address.area,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    latitude: address.latitude,
    longitude: address.longitude,
    isDefault: address.isDefault,
    serviceability: address.serviceable ? 'SERVICEABLE' : 'UNSERVICEABLE',
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

function mapFieldErrors(value: unknown): CustomerAddressFieldErrors {
  if (!isRecord(value)) return {};
  const output: Record<string, string> = {};
  for (const field of FIELD_NAMES) {
    const messages = value[field];
    if (Array.isArray(messages)) {
      const first = messages.find((message): message is string => typeof message === 'string');
      if (first !== undefined) output[field] = first;
    }
  }
  return output;
}

function failure(error: unknown): CustomerAddressFailure {
  const normalized = isRecord(error) && isRecord(error['normalized']) ? error['normalized'] : null;
  const kind = normalized?.['kind'];
  const status = normalized?.['status'];
  const fieldErrors = mapFieldErrors(normalized?.['fieldErrors']);

  if (kind === 'TRANSPORT' || kind === 'TIMEOUT') {
    return { kind: 'FAILURE', failureKind: 'OFFLINE', fieldErrors, requiresRefresh: false };
  }
  if (kind === 'AUTHENTICATION' || status === 401) {
    return {
      kind: 'FAILURE',
      failureKind: 'SESSION_EXPIRED',
      fieldErrors,
      requiresRefresh: false,
    };
  }
  if (kind === 'AUTHORIZATION' || status === 403) {
    return { kind: 'FAILURE', failureKind: 'UNAUTHORIZED', fieldErrors, requiresRefresh: false };
  }
  if (kind === 'VALIDATION') {
    return { kind: 'FAILURE', failureKind: 'VALIDATION', fieldErrors, requiresRefresh: false };
  }
  if (kind === 'NOT_FOUND') {
    return { kind: 'FAILURE', failureKind: 'NOT_FOUND', fieldErrors, requiresRefresh: true };
  }
  if (kind === 'CONFLICT') {
    return { kind: 'FAILURE', failureKind: 'CONFLICT', fieldErrors, requiresRefresh: true };
  }
  if (kind === 'CONTRACT') {
    return { kind: 'FAILURE', failureKind: 'CONTRACT', fieldErrors, requiresRefresh: true };
  }
  if (kind === 'API' || kind === 'RATE_LIMIT') {
    return { kind: 'FAILURE', failureKind: 'UNAVAILABLE', fieldErrors, requiresRefresh: true };
  }
  return { kind: 'FAILURE', failureKind: 'UNKNOWN', fieldErrors, requiresRefresh: true };
}

function body(input: SaveCustomerAddressInput): SaveCustomerAddressInput {
  return { ...input };
}

export class ApiCustomerAddressAdapter implements CustomerAddressPort {
  public constructor(private readonly apiClient: ApiClient) {}

  public async list(): Promise<CustomerAddressListResult> {
    try {
      const responseValue: unknown = await this.apiClient.request('listCustomerAddresses', {});
      const response = responseValue as Readonly<{ readonly data: ListResponse }>;
      return { kind: 'SUCCESS', addresses: response.data.data.addresses.map(mapAddress) };
    } catch (error: unknown) {
      return failure(error);
    }
  }

  public async create(
    input: SaveCustomerAddressInput,
    idempotencyKey: string,
  ): Promise<CustomerAddressMutationResult> {
    try {
      const responseValue: unknown = await this.apiClient.request(
        'createCustomerAddress',
        {
          headers: { 'Idempotency-Key': idempotencyKey },
          body: body(input),
        },
        { allowedFieldErrors: FIELD_NAMES },
      );
      const response = responseValue as Readonly<{ readonly data: AddressResponse }>;
      return { kind: 'SUCCESS', address: mapAddress(response.data.data.address) };
    } catch (error: unknown) {
      return failure(error);
    }
  }

  public async update(
    addressId: string,
    input: SaveCustomerAddressInput,
    idempotencyKey: string,
  ): Promise<CustomerAddressMutationResult> {
    try {
      const responseValue: unknown = await this.apiClient.request(
        'updateCustomerAddress',
        {
          path: { addressId },
          headers: { 'Idempotency-Key': idempotencyKey },
          body: body(input),
        },
        { allowedFieldErrors: FIELD_NAMES },
      );
      const response = responseValue as Readonly<{ readonly data: AddressResponse }>;
      return { kind: 'SUCCESS', address: mapAddress(response.data.data.address) };
    } catch (error: unknown) {
      return failure(error);
    }
  }

  public async remove(
    addressId: string,
    idempotencyKey: string,
  ): Promise<DeleteCustomerAddressResult> {
    try {
      const responseValue: unknown = await this.apiClient.request('deleteCustomerAddress', {
        path: { addressId },
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      const response = responseValue as Readonly<{ readonly data: DeleteResponse }>;
      return { kind: 'SUCCESS', ...response.data.data };
    } catch (error: unknown) {
      return failure(error);
    }
  }

  public async setDefault(
    addressId: string,
    idempotencyKey: string,
  ): Promise<CustomerAddressMutationResult> {
    try {
      const responseValue: unknown = await this.apiClient.request('setCustomerDefaultAddress', {
        path: { addressId },
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      const response = responseValue as Readonly<{ readonly data: AddressResponse }>;
      return { kind: 'SUCCESS', address: mapAddress(response.data.data.address) };
    } catch (error: unknown) {
      return failure(error);
    }
  }
}
