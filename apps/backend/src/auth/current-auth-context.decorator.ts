import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from './auth.types';
import { requireAuthenticatedRequestContext } from './request-context';

export const CurrentAuthContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedRequestContext => {
    const request = context.switchToHttp().getRequest<AuthenticatedHttpRequest>();

    return requireAuthenticatedRequestContext(request);
  },
);
