export type CustomerAddressServiceability = 'SERVICEABLE' | 'UNSERVICEABLE' | 'UNKNOWN';

export interface CustomerAddress {
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
  readonly serviceability: CustomerAddressServiceability;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerAddressDraft {
  readonly label: string;
  readonly recipientName: string;
  readonly phoneNumber: string;
  readonly line1: string;
  readonly line2: string;
  readonly landmark: string;
  readonly area: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly isDefault: boolean;
}

export type CustomerAddressField = keyof CustomerAddressDraft;
export type CustomerAddressFieldErrors = Partial<Readonly<Record<CustomerAddressField, string>>>;

export interface SaveCustomerAddressInput {
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
}

export type CustomerAddressFailureKind =
  | 'OFFLINE'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAVAILABLE'
  | 'CONTRACT'
  | 'UNKNOWN';

export interface CustomerAddressFailure {
  readonly kind: 'FAILURE';
  readonly failureKind: CustomerAddressFailureKind;
  readonly fieldErrors: CustomerAddressFieldErrors;
  readonly requiresRefresh: boolean;
}

export type CustomerAddressListResult =
  | { readonly kind: 'SUCCESS'; readonly addresses: readonly CustomerAddress[] }
  | CustomerAddressFailure;

export type CustomerAddressMutationResult =
  { readonly kind: 'SUCCESS'; readonly address: CustomerAddress } | CustomerAddressFailure;

export type DeleteCustomerAddressResult =
  | {
      readonly kind: 'SUCCESS';
      readonly deletedAddressId: string;
      readonly defaultAddressId: string | null;
    }
  | CustomerAddressFailure;

export interface CustomerAddressPort {
  list(): Promise<CustomerAddressListResult>;
  create(
    input: SaveCustomerAddressInput,
    idempotencyKey: string,
  ): Promise<CustomerAddressMutationResult>;
  update(
    addressId: string,
    input: SaveCustomerAddressInput,
    idempotencyKey: string,
  ): Promise<CustomerAddressMutationResult>;
  remove(addressId: string, idempotencyKey: string): Promise<DeleteCustomerAddressResult>;
  setDefault(addressId: string, idempotencyKey: string): Promise<CustomerAddressMutationResult>;
}

export const EMPTY_CUSTOMER_ADDRESS_DRAFT: CustomerAddressDraft = {
  label: '',
  recipientName: '',
  phoneNumber: '',
  line1: '',
  line2: '',
  landmark: '',
  area: '',
  city: '',
  state: 'Andhra Pradesh',
  postalCode: '',
  latitude: '',
  longitude: '',
  isDefault: false,
};
