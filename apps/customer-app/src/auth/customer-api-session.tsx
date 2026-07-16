import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { AuthSessionPort } from './session-restoration.types';

export interface CustomerApiSession {
  readonly apiBaseUrl: string;
  getAccessToken(): Promise<string | null>;
}

const CustomerApiSessionContext = createContext<CustomerApiSession | null>(null);

export function CustomerApiSessionProvider({
  apiBaseUrl,
  authSession,
  children,
}: {
  readonly apiBaseUrl: string;
  readonly authSession: AuthSessionPort;
  readonly children: ReactNode;
}) {
  const value = useMemo<CustomerApiSession>(
    () => ({
      apiBaseUrl,
      async getAccessToken(): Promise<string | null> {
        const session = await authSession.getSession();
        return session?.accessToken ?? null;
      },
    }),
    [apiBaseUrl, authSession],
  );

  return (
    <CustomerApiSessionContext.Provider value={value}>
      {children}
    </CustomerApiSessionContext.Provider>
  );
}

export function useCustomerApiSession(): CustomerApiSession {
  const session = useContext(CustomerApiSessionContext);

  if (session === null) {
    throw new TypeError('Customer API session is unavailable');
  }

  return session;
}
