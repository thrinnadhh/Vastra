import { Inject, Injectable } from '@nestjs/common';

import { createAccountBlockedException, createAccountPendingException } from './auth-http-error';
import type { AuthenticatedRequestContext } from './auth.types';
import {
  createAccountTypeForbiddenException,
  createAuthorizationProviderUnavailableException,
} from './authorization-http-error';
import {
  OperationalReadinessDataInvalidError,
  OperationalReadinessGatewayUnavailableError,
  type OperationalReadinessGateway,
} from './operational-readiness.gateway';
import { OPERATIONAL_READINESS_GATEWAY } from './operational-readiness.tokens';
import type {
  CaptainOperationalProfile,
  MerchantOnboardingStatus,
  MerchantOperationalProfile,
} from './operational-readiness.types';

function isBlockedMerchantOnboardingStatus(status: MerchantOnboardingStatus): boolean {
  return status === 'PAUSED' || status === 'SUSPENDED' || status === 'REJECTED';
}

@Injectable()
export class OperationalReadinessService {
  public constructor(
    @Inject(OPERATIONAL_READINESS_GATEWAY)
    private readonly gateway: OperationalReadinessGateway,
  ) {}

  public async assertOperationallyReady(context: AuthenticatedRequestContext): Promise<void> {
    switch (context.actor.accountType) {
      case 'MERCHANT':
        await this.assertMerchantReady(context);
        return;
      case 'CAPTAIN':
        await this.assertCaptainReady(context);
        return;
      case 'CUSTOMER':
      case 'ADMIN':
        throw createAccountTypeForbiddenException();
    }
  }

  private async assertMerchantReady(context: AuthenticatedRequestContext): Promise<void> {
    const profile = await this.loadMerchantProfile(context);

    if (profile === null) {
      throw createAccountPendingException();
    }

    if (
      profile.kycStatus === 'REJECTED' ||
      isBlockedMerchantOnboardingStatus(profile.onboardingStatus)
    ) {
      throw createAccountBlockedException();
    }

    if (
      profile.kycStatus !== 'VERIFIED' ||
      profile.onboardingStatus !== 'ACTIVE' ||
      profile.approvedAt === null
    ) {
      throw createAccountPendingException();
    }
  }

  private async assertCaptainReady(context: AuthenticatedRequestContext): Promise<void> {
    const profile = await this.loadCaptainProfile(context);

    if (profile === null) {
      throw createAccountPendingException();
    }

    if (profile.kycStatus === 'REJECTED' || profile.availabilityStatus === 'SUSPENDED') {
      throw createAccountBlockedException();
    }

    if (profile.kycStatus !== 'VERIFIED' || profile.approvedAt === null) {
      throw createAccountPendingException();
    }
  }

  private async loadMerchantProfile(
    context: AuthenticatedRequestContext,
  ): Promise<MerchantOperationalProfile | null> {
    try {
      return await this.gateway.findMerchantOperationalProfile(context.supabase, context.actor.id);
    } catch (error: unknown) {
      return this.rethrowProviderError(error);
    }
  }

  private async loadCaptainProfile(
    context: AuthenticatedRequestContext,
  ): Promise<CaptainOperationalProfile | null> {
    try {
      return await this.gateway.findCaptainOperationalProfile(context.supabase, context.actor.id);
    } catch (error: unknown) {
      return this.rethrowProviderError(error);
    }
  }

  private rethrowProviderError(error: unknown): never {
    if (
      error instanceof OperationalReadinessGatewayUnavailableError ||
      error instanceof OperationalReadinessDataInvalidError
    ) {
      throw createAuthorizationProviderUnavailableException();
    }

    throw createAuthorizationProviderUnavailableException();
  }
}
