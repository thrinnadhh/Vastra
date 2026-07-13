import type { SupabaseClient } from './supabase-client.type';
import type { IncomingHttpHeaders } from 'node:http';

export const ACCOUNT_TYPES = ['CUSTOMER', 'MERCHANT', 'CAPTAIN', 'ADMIN'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const PROFILE_STATUSES = ['ACTIVE', 'PENDING', 'BLOCKED', 'SUSPENDED', 'DELETED'] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const AUTHENTICATOR_ASSURANCE_LEVELS = ['aal1', 'aal2'] as const;
export type AuthenticatorAssuranceLevel = (typeof AUTHENTICATOR_ASSURANCE_LEVELS)[number];

export interface VerifiedIdentity {
  readonly id: string;
  readonly email: string | null;
}

export interface ProfileSnapshot {
  readonly id: string;
  readonly accountType: AccountType;
  readonly status: ProfileStatus;
}

export interface AuthenticatedActor {
  readonly id: string;
  readonly email: string | null;
  readonly accountType: AccountType;
  readonly status: 'ACTIVE';
}

export interface AuthenticatedRequestContext {
  readonly actor: AuthenticatedActor;
  readonly accessToken: string;
  readonly supabase: SupabaseClient;

  /**
   * Supabase Auth session assurance. Production authentication always sets this.
   * Missing legacy/test values are treated as aal1 by MFA enforcement.
   */
  readonly assuranceLevel?: AuthenticatorAssuranceLevel;
}

export interface AuthenticatedHttpRequest {
  readonly headers: IncomingHttpHeaders;
  authContext?: AuthenticatedRequestContext;
}
