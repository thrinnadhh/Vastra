import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { createAuthRequiredException, createMfaRequiredException } from './auth-http-error';
import type { AuthenticatedHttpRequest } from './auth.types';
import { PUBLIC_ROUTE_METADATA } from './public.decorator';

@Injectable()
export class AdminMfaGuard implements CanActivate {
  public constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  public canActivate(executionContext: ExecutionContext): boolean {
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

    if (authContext.actor.accountType !== 'ADMIN') {
      return true;
    }

    if (authContext.assuranceLevel !== 'aal2') {
      throw createMfaRequiredException();
    }

    return true;
  }
}
