import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedActor, AuthenticatedHttpRequest } from './auth.types';
import { requireAuthenticatedRequestContext } from './request-context';

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor => {
    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();

    return requireAuthenticatedRequestContext(request).actor;
  },
);
