export interface CustomerAddressSnapshot {
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
  readonly countryCode: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly isDefault: boolean;
  readonly serviceable: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCustomerAddressInput {
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

export type UpdateCustomerAddressInput = Partial<CreateCustomerAddressInput>;

interface ResponseMeta {
  readonly requestId: null;
}
export interface ListCustomerAddressesResponse {
  readonly success: true;
  readonly data: { readonly addresses: readonly CustomerAddressSnapshot[] };
  readonly meta: ResponseMeta;
}
export interface CustomerAddressResponse {
  readonly success: true;
  readonly data: { readonly address: CustomerAddressSnapshot };
  readonly meta: ResponseMeta;
}
export interface DeleteCustomerAddressResponse {
  readonly success: true;
  readonly data: { readonly deletedAddressId: string; readonly defaultAddressId: string | null };
  readonly meta: ResponseMeta;
}
