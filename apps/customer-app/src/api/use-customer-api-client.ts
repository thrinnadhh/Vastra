import { createApiClient, type ApiClient, type FetchLike } from '@vastra/api-client';
import { useMemo } from 'react';

import { useCustomerApiSession } from '../auth/customer-api-session';

const runtimeFetch = globalThis.fetch as unknown as FetchLike;

export function useCustomerApiClient(): ApiClient {
  const session = useCustomerApiSession();

  return useMemo(
    () =>
      createApiClient({
        baseUrl: session.apiBaseUrl,
        fetch: runtimeFetch,
        accessTokenProvider: {
          getAccessToken: () => session.getAccessToken(),
        },
        actor: 'customer',
      }),
    [session],
  );
}
