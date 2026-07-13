import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { createAuthRequiredException } from './auth-http-error';
import type { AuthenticatedHttpRequest } from './auth.types';
import { OPERATIONAL_READINESS_METADATA } from './operational-readiness.decorator';
import { OperationalReadinessService } from './operational-readiness.service';
import { PUBLIC_ROUTE_METADATA } from './public.decorator';

@Injectable()
export class OperationalReadinessGuard implements CanActivate {
  public constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(OperationalReadinessService)
    private readonly readinessService: OperationalReadinessService,
  ) {}

  public async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const publicRoute = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_METADATA, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);

    if (publicRoute) {
      return true;
    }

    const readinessRequired = this.reflector.getAllAndOverride<boolean>(
      OPERATIONAL_READINESS_METADATA,
      [executionContext.getHandler(), executionContext.getClass()],
    );

    if (!readinessRequired) {
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

    await this.readinessService.assertOperationallyReady(authContext);
    return true;
  }
}
