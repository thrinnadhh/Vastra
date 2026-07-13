import { createAuthRequiredException } from './auth-http-error';
import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from './auth.types';

export function requireAuthenticatedRequestContext(
  request: AuthenticatedHttpRequest,
): AuthenticatedRequestContext {
  if (request.authContext === undefined) {
    throw createAuthRequiredException();
  }

  return request.authContext;
}
