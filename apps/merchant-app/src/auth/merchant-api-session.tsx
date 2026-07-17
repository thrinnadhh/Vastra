import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface MerchantApiSession {
  readonly apiBaseUrl: string;
  getAccessToken(): Promise<string | null>;
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
