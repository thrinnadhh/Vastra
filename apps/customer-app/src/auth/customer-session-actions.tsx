import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { AuthSessionPort, CurrentAccount } from './session-restoration.types';

export interface CustomerSessionActions {
  readonly account: CurrentAccount & { readonly accountType: 'CUSTOMER' };
  signOut(): Promise<void>;
}

const CustomerSessionActionsContext = createContext<CustomerSessionActions | null>(null);

export function CustomerSessionActionsProvider({
  account,
  authSession,
  children,
}: {
  readonly account: CurrentAccount & { readonly accountType: 'CUSTOMER' };
  readonly authSession: AuthSessionPort;
  readonly children: ReactNode;
}) {
  const value = useMemo<CustomerSessionActions>(
    () => ({
      account,
      signOut: () => authSession.signOutLocal(),
    }),
    [account, authSession],
  );

  return (
    <CustomerSessionActionsContext.Provider value={value}>
      {children}
    </CustomerSessionActionsContext.Provider>
  );
}

export function useCustomerSessionActions(): CustomerSessionActions {
  const actions = useContext(CustomerSessionActionsContext);
  if (actions === null) {
    throw new TypeError('Customer session actions are unavailable');
  }
  return actions;
}
