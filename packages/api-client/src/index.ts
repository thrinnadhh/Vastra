import createClient, { type ClientOptions } from 'openapi-fetch';

import type { components, operations, paths } from './generated/schema.js';

export type VastraApiComponents = components;
export type VastraApiOperations = operations;
export type VastraApiPaths = paths;

export type VastraApiClientOptions = Omit<ClientOptions, 'baseUrl'> & {
  readonly baseUrl: string;
};

/**
 * Creates the shared, OpenAPI-typed client used by Vastra applications.
 * Authentication remains explicit so callers can supply the current session token.
 */
export function createVastraApiClient(options: VastraApiClientOptions) {
  return createClient<paths>({
    ...options,
    baseUrl: options.baseUrl.replace(/\/$/u, ''),
  });
}
