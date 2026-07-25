import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface MerchantApiSession {
  readonly apiBaseUrl: string;
  getAccessToken(): Promise<string | null>;
  expireSession?(): Promise<void>;
}

const MerchantApiSessionContext = createContext<MerchantApiSession | null>(null);

export function MerchantApiSessionProvider({
  apiBaseUrl,
  client,
  children,
}: {
  readonly apiBaseUrl: string;
  readonly client: SupabaseClient;
  readonly children: ReactNode;
}) {
  const value = useMemo<MerchantApiSession>(
    () => ({
      apiBaseUrl,
      async getAccessToken(): Promise<string | null> {
        const response = await client.auth.getSession();
        if (response.error !== null) throw response.error;
        return response.data.session?.access_token ?? null;
      },
      async expireSession(): Promise<void> {
        const response = await client.auth.signOut({ scope: 'local' });
        if (response.error !== null) throw response.error;
      },
    }),
    [apiBaseUrl, client],
  );

  return (
    <MerchantApiSessionContext.Provider value={value}>
      {children}
    </MerchantApiSessionContext.Provider>
  );
}

export function useMerchantApiSession(): MerchantApiSession {
  const session = useContext(MerchantApiSessionContext);
  if (session === null) throw new TypeError('Merchant API session is unavailable');
  return session;
}
