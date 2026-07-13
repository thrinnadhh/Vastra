import { Inject, Injectable } from '@nestjs/common';

import {
  createAccountBlockedException,
  createAccountPendingException,
  createAuthenticationProviderUnavailableException,
  createAuthRequiredException,
  createExpiredTokenException,
} from './auth-http-error';
import type {
  AuthenticatedActor,
  AuthenticatedRequestContext,
  ProfileSnapshot,
} from './auth.types';
import {
  AuthenticationProviderUnavailableError,
  type AuthenticationGateway,
  type TokenVerificationResult,
} from './supabase.gateway';
import { AUTHENTICATION_GATEWAY } from './supabase.tokens';

@Injectable()
export class AuthService {
  public constructor(
    @Inject(AUTHENTICATION_GATEWAY)
    private readonly gateway: AuthenticationGateway,
  ) {}

  public async authenticate(accessToken: string): Promise<AuthenticatedRequestContext> {
    const verification = await this.verifyAccessToken(accessToken);

    if (!verification.valid) {
      if (verification.reason === 'EXPIRED') {
        throw createExpiredTokenException();
      }

      throw createAuthRequiredException();
    }

    const profile = await this.findProfile(verification.identity.id);

    if (profile === null) {
      throw createAccountPendingException();
    }

    this.assertActiveProfile(profile);

    const actor: AuthenticatedActor = {
      id: verification.identity.id,
      email: verification.identity.email,
      accountType: profile.accountType,
      status: 'ACTIVE',
    };

    return {
      actor,
      accessToken,
      supabase: this.gateway.createUserClient(accessToken),
    };
  }

  private async verifyAccessToken(accessToken: string): Promise<TokenVerificationResult> {
    try {
      return await this.gateway.verifyAccessToken(accessToken);
    } catch (error: unknown) {
      if (error instanceof AuthenticationProviderUnavailableError) {
        throw createAuthenticationProviderUnavailableException();
      }

      throw createAuthenticationProviderUnavailableException();
    }
  }

  private async findProfile(userId: string): Promise<ProfileSnapshot | null> {
    try {
      return await this.gateway.findProfile(userId);
    } catch (error: unknown) {
      if (error instanceof AuthenticationProviderUnavailableError) {
        throw createAuthenticationProviderUnavailableException();
      }

      throw createAuthenticationProviderUnavailableException();
    }
  }

  private assertActiveProfile(
    profile: ProfileSnapshot,
  ): asserts profile is ProfileSnapshot & { readonly status: 'ACTIVE' } {
    switch (profile.status) {
      case 'ACTIVE':
        return;
      case 'PENDING':
        throw createAccountPendingException();
      case 'BLOCKED':
      case 'SUSPENDED':
      case 'DELETED':
        throw createAccountBlockedException();
    }
  }
}
