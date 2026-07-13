import { Inject, Injectable } from '@nestjs/common';

import {
  createAccountTypeForbiddenException,
  createAuthorizationProviderUnavailableException,
  createPermissionDeniedException,
} from './authorization-http-error';
import {
  AuthorizationDataInvalidError,
  AuthorizationGatewayUnavailableError,
  type AuthorizationGateway,
} from './authorization.gateway';
import { AUTHORIZATION_GATEWAY } from './authorization.tokens';
import type { AccountType, AuthenticatedRequestContext } from './auth.types';

@Injectable()
export class AuthorizationService {
  public constructor(
    @Inject(AUTHORIZATION_GATEWAY)
    private readonly gateway: AuthorizationGateway,
  ) {}

  public assertAllowedAccountType(
    accountType: AccountType,
    allowedAccountTypes: readonly AccountType[],
  ): void {
    if (!allowedAccountTypes.some((allowedAccountType) => allowedAccountType === accountType)) {
      throw createAccountTypeForbiddenException();
    }
  }

  public async assertPermissions(
    context: AuthenticatedRequestContext,
    requiredPermissionCodes: readonly string[],
  ): Promise<void> {
    if (requiredPermissionCodes.length === 0) {
      return;
    }

    if (context.actor.accountType !== 'ADMIN') {
      throw createPermissionDeniedException();
    }

    const uniqueRequiredPermissionCodes = [...new Set(requiredPermissionCodes)];

    let grantedPermissionCodes: readonly string[];

    try {
      grantedPermissionCodes = await this.gateway.findGrantedPermissionCodes(
        context.supabase,
        uniqueRequiredPermissionCodes,
      );
    } catch (error: unknown) {
      if (
        error instanceof AuthorizationGatewayUnavailableError ||
        error instanceof AuthorizationDataInvalidError
      ) {
        throw createAuthorizationProviderUnavailableException();
      }

      throw createAuthorizationProviderUnavailableException();
    }

    const granted = new Set(grantedPermissionCodes);

    if (!uniqueRequiredPermissionCodes.every((permissionCode) => granted.has(permissionCode))) {
      throw createPermissionDeniedException();
    }
  }
}
