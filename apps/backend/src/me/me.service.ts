import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createMeProviderUnavailableException,
  createProfileStateInvalidException,
} from './me-http-error';
import { type MeGateway, MeGatewayUnavailableError, MeProfileDataInvalidError } from './me.gateway';
import { ME_GATEWAY } from './me.tokens';
import type {
  CommonProfileSnapshot,
  CurrentAccountProfile,
  GetCurrentAccountResponse,
} from './me.types';

@Injectable()
export class MeService {
  public constructor(
    @Inject(ME_GATEWAY)
    private readonly gateway: MeGateway,
  ) {}

  public async getCurrentAccount(
    context: AuthenticatedRequestContext,
  ): Promise<GetCurrentAccountResponse> {
    try {
      const commonProfile = await this.gateway.findCommonProfile(
        context.supabase,
        context.actor.id,
      );

      this.assertCommonProfileMatchesActor(commonProfile, context);

      const profile: CurrentAccountProfile = {
        fullName: commonProfile.fullName,
        phoneNumber: commonProfile.phoneNumber,
        avatarUrl: commonProfile.avatarUrl,
      };

      switch (context.actor.accountType) {
        case 'CUSTOMER': {
          const roleProfile = await this.gateway.findCustomerProfile(
            context.supabase,
            context.actor.id,
          );

          if (roleProfile === null) {
            throw createProfileStateInvalidException();
          }

          return {
            success: true,
            data: {
              id: context.actor.id,
              email: context.actor.email,
              accountType: 'CUSTOMER',
              status: 'ACTIVE',
              profile,
              roleProfile: {
                kind: 'CUSTOMER',
                ...roleProfile,
              },
              scope: {
                kind: 'CUSTOMER',
              },
            },
            meta: {
              requestId: null,
            },
          };
        }

        case 'MERCHANT': {
          const roleProfile = await this.gateway.findMerchantProfile(
            context.supabase,
            context.actor.id,
          );

          if (roleProfile === null) {
            throw createProfileStateInvalidException();
          }

          const shops = await this.gateway.findMerchantShops(context.supabase, context.actor.id);

          return {
            success: true,
            data: {
              id: context.actor.id,
              email: context.actor.email,
              accountType: 'MERCHANT',
              status: 'ACTIVE',
              profile,
              roleProfile: {
                kind: 'MERCHANT',
                ...roleProfile,
              },
              scope: {
                kind: 'MERCHANT',
                shops,
              },
            },
            meta: {
              requestId: null,
            },
          };
        }

        case 'CAPTAIN': {
          const roleProfile = await this.gateway.findCaptainProfile(
            context.supabase,
            context.actor.id,
          );

          if (roleProfile === null) {
            throw createProfileStateInvalidException();
          }

          return {
            success: true,
            data: {
              id: context.actor.id,
              email: context.actor.email,
              accountType: 'CAPTAIN',
              status: 'ACTIVE',
              profile,
              roleProfile: {
                kind: 'CAPTAIN',
                ...roleProfile,
              },
              scope: {
                kind: 'CAPTAIN',
                captainCode: roleProfile.captainCode,
                availabilityStatus: roleProfile.availabilityStatus,
              },
            },
            meta: {
              requestId: null,
            },
          };
        }

        case 'ADMIN': {
          const roleProfile = await this.gateway.findAdminProfile(
            context.supabase,
            context.actor.id,
          );

          if (roleProfile === null) {
            throw createProfileStateInvalidException();
          }

          return {
            success: true,
            data: {
              id: context.actor.id,
              email: context.actor.email,
              accountType: 'ADMIN',
              status: 'ACTIVE',
              profile,
              roleProfile: {
                kind: 'ADMIN',
                ...roleProfile,
              },
              scope: {
                kind: 'ADMIN',
                department: roleProfile.department,
                cityScope: roleProfile.cityScope,
              },
            },
            meta: {
              requestId: null,
            },
          };
        }
      }
    } catch (error: unknown) {
      if (error instanceof MeGatewayUnavailableError) {
        throw createMeProviderUnavailableException();
      }

      if (error instanceof MeProfileDataInvalidError) {
        throw createProfileStateInvalidException();
      }

      throw error;
    }
  }

  private assertCommonProfileMatchesActor(
    profile: CommonProfileSnapshot | null,
    context: AuthenticatedRequestContext,
  ): asserts profile is CommonProfileSnapshot & { readonly status: 'ACTIVE' } {
    if (
      profile?.id !== context.actor.id ||
      profile.accountType !== context.actor.accountType ||
      profile.status !== 'ACTIVE'
    ) {
      throw createProfileStateInvalidException();
    }
  }
}
