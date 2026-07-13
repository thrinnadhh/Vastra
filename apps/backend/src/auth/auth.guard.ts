import { type CanActivate, type ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { createAuthRequiredException } from './auth-http-error';
import { AuthService } from './auth.service';
import type { AuthenticatedHttpRequest } from './auth.types';
import { extractBearerToken } from './bearer-token';
import { PUBLIC_ROUTE_METADATA } from './public.decorator';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  public constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const publicRoute = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (publicRoute) {
      return true;
    }

    if (context.getType() !== 'http') {
      throw createAuthRequiredException();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();

    const accessToken = extractBearerToken(request.headers.authorization);

    if (accessToken === null) {
      throw createAuthRequiredException();
    }

    request.authContext = await this.authService.authenticate(accessToken);
    return true;
  }
}
