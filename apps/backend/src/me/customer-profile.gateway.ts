import type { SupabaseClient } from '../auth/supabase-client.type';
import { Injectable } from '@nestjs/common';

import type {
  CustomerProfileUpdateSnapshot,
  UpdateCustomerProfileInput,
} from './customer-profile.types';

export interface CustomerProfileGateway {
  updateCurrentCustomerProfile(
    client: SupabaseClient,
    input: UpdateCustomerProfileInput,
  ): Promise<CustomerProfileUpdateSnapshot>;
}

export class CustomerProfileGatewayUnavailableError extends Error {
  public constructor() {
    super('Customer profile provider unavailable');
    this.name = 'CustomerProfileGatewayUnavailableError';
  }
}

export class CustomerProfileStateInvalidError extends Error {
  public constructor() {
    super('Customer profile state invalid');
    this.name = 'CustomerProfileStateInvalidError';
  }
}

export class CustomerProfileDataInvalidError extends Error {
  public constructor() {
    super('Customer profile response invalid');
    this.name = 'CustomerProfileDataInvalidError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUpdateSnapshot(value: unknown): CustomerProfileUpdateSnapshot {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    throw new CustomerProfileDataInvalidError();
  }

  const fullName = value[0]['full_name'];
  const profileCompleted = value[0]['profile_completed'];
  const updatedAt = value[0]['updated_at'];

  if (
    typeof fullName !== 'string' ||
    fullName.length === 0 ||
    profileCompleted !== true ||
    typeof updatedAt !== 'string' ||
    Number.isNaN(Date.parse(updatedAt))
  ) {
    throw new CustomerProfileDataInvalidError();
  }

  return {
    fullName,
    profileCompleted: true,
    updatedAt,
  };
}

function rethrowGatewayError(error: unknown): never {
  if (
    error instanceof CustomerProfileGatewayUnavailableError ||
    error instanceof CustomerProfileStateInvalidError ||
    error instanceof CustomerProfileDataInvalidError
  ) {
    throw error;
  }

  throw new CustomerProfileGatewayUnavailableError();
}

@Injectable()
export class SupabaseCustomerProfileGateway implements CustomerProfileGateway {
  public async updateCurrentCustomerProfile(
    client: SupabaseClient,
    input: UpdateCustomerProfileInput,
  ): Promise<CustomerProfileUpdateSnapshot> {
    try {
      const response = await client.rpc('update_current_customer_profile', {
        p_full_name: input.fullName,
      });

      if (response.error !== null) {
        if (response.error.code === 'P0002') {
          throw new CustomerProfileStateInvalidError();
        }

        throw new CustomerProfileGatewayUnavailableError();
      }

      return parseUpdateSnapshot(response.data);
    } catch (error: unknown) {
      return rethrowGatewayError(error);
    }
  }
}
