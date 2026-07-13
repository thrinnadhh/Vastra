import type { SupabaseClient } from './supabase-client.type';
import { Injectable } from '@nestjs/common';

export interface AuthorizationGateway {
  findGrantedPermissionCodes(
    client: SupabaseClient,
    requiredPermissionCodes: readonly string[],
  ): Promise<readonly string[]>;
}

export class AuthorizationGatewayUnavailableError extends Error {
  public constructor() {
    super('Authorization data provider unavailable');
    this.name = 'AuthorizationGatewayUnavailableError';
  }
}

export class AuthorizationDataInvalidError extends Error {
  public constructor() {
    super('Authorization data is invalid');
    this.name = 'AuthorizationDataInvalidError';
  }
}

function parsePermissionCodes(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new AuthorizationDataInvalidError();
  }

  return value.map((row) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new AuthorizationDataInvalidError();
    }

    const code = (row as Record<string, unknown>)['code'];

    if (typeof code !== 'string' || code.trim().length === 0) {
      throw new AuthorizationDataInvalidError();
    }

    return code;
  });
}

function rethrowAuthorizationGatewayError(error: unknown): never {
  if (
    error instanceof AuthorizationGatewayUnavailableError ||
    error instanceof AuthorizationDataInvalidError
  ) {
    throw error;
  }

  throw new AuthorizationGatewayUnavailableError();
}

@Injectable()
export class SupabaseAuthorizationGateway implements AuthorizationGateway {
  public async findGrantedPermissionCodes(
    client: SupabaseClient,
    requiredPermissionCodes: readonly string[],
  ): Promise<readonly string[]> {
    if (requiredPermissionCodes.length === 0) {
      return [];
    }

    try {
      const response = await client
        .from('permissions')
        .select('code')
        .in('code', [...requiredPermissionCodes]);

      if (response.error !== null) {
        throw new AuthorizationGatewayUnavailableError();
      }

      const data: unknown = response.data;
      return parsePermissionCodes(data);
    } catch (error: unknown) {
      return rethrowAuthorizationGatewayError(error);
    }
  }
}
