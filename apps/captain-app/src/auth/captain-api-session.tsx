import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { AuthSessionPort } from './session-restoration.types';

export interface CaptainApiSession {
  readonly apiBaseUrl: string;
  getAccessToken(): Promise<string | null>;
  expireSession(): Promise<void>;
}

const CaptainApiSessionContext = createContext<CaptainApiSession | null>(null);

export function CaptainApiSessionProvider({
  apiBaseUrl,
  authSession,
  children,
}: {
  readonly apiBaseUrl: string;
  readonly authSession: AuthSessionPort;
  readonly children: ReactNode;
}) {
  const value = useMemo<CaptainApiSession>(
    () => ({
      apiBaseUrl,
      async getAccessToken(): Promise<string | null> {
        const session = await authSession.getSession();
        return session?.accessToken ?? null;
      },
      async expireSession(): Promise<void> {
        await authSession.signOutLocal();
      },
    }),
    [apiBaseUrl, authSession],
  );

  return (
    <CaptainApiSessionContext.Provider value={value}>{children}</CaptainApiSessionContext.Provider>
  );
}

export function useCaptainApiSession(): CaptainApiSession {
  const session = useContext(CaptainApiSessionContext);

  if (session === null) {
    throw new TypeError('Captain API session is unavailable');
  }

  return session;
}
