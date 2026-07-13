import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ALLOWED_ACCOUNT_TYPES_METADATA } from './account-types.decorator';
import { createAuthRequiredException } from './auth-http-error';
import type { AccountType, AuthenticatedHttpRequest } from './auth.types';
import { AuthorizationService } from './authorization.service';
import { REQUIRED_PERMISSIONS_METADATA } from './permissions.decorator';
import { PUBLIC_ROUTE_METADATA } from './public.decorator';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  public constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  public async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const publicRoute = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_METADATA, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);

    if (publicRoute) {
      return true;
    }

    if (executionContext.getType() !== 'http') {
      throw createAuthRequiredException();
    }

    const request = executionContext.switchToHttp().getRequest<AuthenticatedHttpRequest>();
    const authContext = request.authContext;

    if (authContext === undefined) {
      throw createAuthRequiredException();
    }

    const allowedAccountTypes = this.reflector.getAllAndOverride<
      readonly AccountType[] | undefined
    >(ALLOWED_ACCOUNT_TYPES_METADATA, [executionContext.getHandler(), executionContext.getClass()]);

    if (allowedAccountTypes !== undefined) {
      this.authorizationService.assertAllowedAccountType(
        authContext.actor.accountType,
        allowedAccountTypes,
      );
    }

    const requiredPermissions = this.reflector.getAllAndOverride<readonly string[] | undefined>(
      REQUIRED_PERMISSIONS_METADATA,
      [executionContext.getHandler(), executionContext.getClass()],
    );

    if (requiredPermissions !== undefined) {
      await this.authorizationService.assertPermissions(authContext, requiredPermissions);
    }

    return true;
  }
}
