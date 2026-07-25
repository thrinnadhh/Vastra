import { createApiClient, type ApiClient, type FetchLike } from '@vastra/api-client';
import { useMemo } from 'react';

import { useMerchantApiSession } from '../auth/merchant-api-session';

const runtimeFetch = globalThis.fetch as unknown as FetchLike;

export function useMerchantApiClient(): ApiClient {
  const session = useMerchantApiSession();

  return useMemo(
    () =>
      createApiClient({
        baseUrl: session.apiBaseUrl,
        fetch: runtimeFetch,
        accessTokenProvider: {
          getAccessToken: () => session.getAccessToken(),
        },
        actor: 'merchant',
      }),
    [session],
  );
}
