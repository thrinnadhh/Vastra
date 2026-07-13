import type { SupabaseClient } from './supabase-client.type';
import type { IncomingHttpHeaders } from 'node:http';

export const ACCOUNT_TYPES = ['CUSTOMER', 'MERCHANT', 'CAPTAIN', 'ADMIN'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const PROFILE_STATUSES = ['ACTIVE', 'PENDING', 'BLOCKED', 'SUSPENDED', 'DELETED'] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

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
}

export interface AuthenticatedHttpRequest {
  readonly headers: IncomingHttpHeaders;
  authContext?: AuthenticatedRequestContext;
}
