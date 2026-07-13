import type { SupabaseClient } from './supabase-client.type';

import { Inject, Injectable } from '@nestjs/common';
import { createClient, type WebSocketLikeConstructor } from '@supabase/supabase-js';
import WebSocket from 'ws';

import {
  ACCOUNT_TYPES,
  PROFILE_STATUSES,
  type AccountType,
  type AuthenticatorAssuranceLevel,
  type ProfileSnapshot,
  type ProfileStatus,
  type VerifiedIdentity,
} from './auth.types';
import { SUPABASE_CONFIGURATION, type SupabaseConfiguration } from './supabase.configuration';
import { SUPABASE_SERVICE_CLIENT } from './supabase.tokens';

export type TokenVerificationResult =
  | {
      readonly valid: true;
      readonly identity: VerifiedIdentity;
      readonly assuranceLevel?: AuthenticatorAssuranceLevel;
    }
  | {
      readonly valid: false;
      readonly reason: 'INVALID' | 'EXPIRED';
    };

export interface AuthenticationGateway {
  verifyAccessToken(accessToken: string): Promise<TokenVerificationResult>;

  findProfile(userId: string): Promise<ProfileSnapshot | null>;

  createUserClient(accessToken: string): SupabaseClient;
}

export class AuthenticationProviderUnavailableError extends Error {
  public constructor() {
    super('Authentication provider unavailable');
    this.name = 'AuthenticationProviderUnavailableError';
  }
}

/**
 * The ws package exposes several constructor overloads,
 * including an internal null-address overload.
 *
 * Supabase Realtime expects only the normal client-side
 * WebSocket constructor, so expose that exact constructor.
 */
class NodeWebSocketTransport extends WebSocket {
  public constructor(address: string | URL, protocols?: string | string[]) {
    super(address, protocols);
  }
}

function createClientOptions() {
  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    realtime: {
      // NodeWebSocketTransport is runtime-compatible with the browser
      // WebSocket API that Supabase Realtime expects. The cast is
      // needed because @types/ws Event types are structurally
      // incompatible with the DOM Event types Supabase declares.
      transport: NodeWebSocketTransport as unknown as WebSocketLikeConstructor,
    },
  };
}

export function createSupabaseServiceClient(configuration: SupabaseConfiguration): SupabaseClient {
  return createClient(configuration.url, configuration.serviceRoleKey, createClientOptions());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAccountType(value: unknown): value is AccountType {
  return typeof value === 'string' && ACCOUNT_TYPES.some((candidate) => candidate === value);
}

function isProfileStatus(value: unknown): value is ProfileStatus {
  return typeof value === 'string' && PROFILE_STATUSES.some((candidate) => candidate === value);
}

function parseProfileSnapshot(value: unknown): ProfileSnapshot | null {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    throw new AuthenticationProviderUnavailableError();
  }

  const id = value['id'];
  const accountType = value['account_type'];
  const status = value['status'];

  if (typeof id !== 'string' || !isAccountType(accountType) || !isProfileStatus(status)) {
    throw new AuthenticationProviderUnavailableError();
  }

  return {
    id,
    accountType,
    status,
  };
}

function isExpiredAuthError(code: unknown, message: string): boolean {
  const normalizedCode = typeof code === 'string' ? code : '';

  return `${normalizedCode} ${message}`.toLowerCase().includes('expired');
}

/**
 * The token is decoded only after Supabase Auth has verified it with getUser().
 * Missing, malformed, or unsupported assurance claims fail closed to aal1.
 */
function readAuthenticatorAssuranceLevel(accessToken: string): AuthenticatorAssuranceLevel {
  const payloadSegment = accessToken.split('.')[1];

  if (payloadSegment === undefined) {
    return 'aal1';
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadSegment, 'base64url').toString('utf8'),
    ) as unknown;

    if (!isRecord(payload)) {
      return 'aal1';
    }

    return payload['aal'] === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

@Injectable()
export class SupabaseAuthenticationGateway implements AuthenticationGateway {
  public constructor(
    @Inject(SUPABASE_CONFIGURATION)
    private readonly configuration: SupabaseConfiguration,
    @Inject(SUPABASE_SERVICE_CLIENT)
    private readonly serviceClient: SupabaseClient,
  ) {}

  public async verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    try {
      const { data, error } = await this.serviceClient.auth.getUser(accessToken);

      if (error !== null) {
        if ((error.status ?? 0) >= 500) {
          throw new AuthenticationProviderUnavailableError();
        }

        return {
          valid: false,
          reason: isExpiredAuthError(error.code, error.message) ? 'EXPIRED' : 'INVALID',
        };
      }

      return {
        valid: true,
        identity: {
          id: data.user.id,
          email: data.user.email ?? null,
        },
        assuranceLevel: readAuthenticatorAssuranceLevel(accessToken),
      };
    } catch (error: unknown) {
      if (error instanceof AuthenticationProviderUnavailableError) {
        throw error;
      }

      throw new AuthenticationProviderUnavailableError();
    }
  }

  public async findProfile(userId: string): Promise<ProfileSnapshot | null> {
    try {
      const response = await this.serviceClient
        .from('profiles')
        .select('id, account_type, status')
        .eq('id', userId)
        .maybeSingle();

      if (response.error !== null) {
        throw new AuthenticationProviderUnavailableError();
      }

      const profileData: unknown = response.data;

      return parseProfileSnapshot(profileData);
    } catch (error: unknown) {
      if (error instanceof AuthenticationProviderUnavailableError) {
        throw error;
      }

      throw new AuthenticationProviderUnavailableError();
    }
  }

  public createUserClient(accessToken: string): SupabaseClient {
    return createClient(this.configuration.url, this.configuration.publishableKey, {
      ...createClientOptions(),
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }
}
