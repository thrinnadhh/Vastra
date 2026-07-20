import { SessionRestorationService } from './session-restoration.service';
import type {
  AuthSessionPort,
  CurrentAccount,
  CurrentAccountLookupResult,
  CurrentAccountPort,
  RestorableSession,
} from './session-restoration.types';

const SESSION: RestorableSession = {
  userId: '10000000-0000-4000-8000-000000000001',
  accessToken: 'captain-access-token',
};

const ACCOUNT: CurrentAccount = {
  id: SESSION.userId,
  accountType: 'CAPTAIN',
  status: 'ACTIVE',
  fullName: 'Captain One',
  availabilityStatus: 'OFFLINE',
};

class AuthSessionStub implements AuthSessionPort {
  public session: RestorableSession | null = SESSION;
  public signOutCalls = 0;

  public getSession(): Promise<RestorableSession | null> {
    return Promise.resolve(this.session);
  }

  public onSessionChange(): () => void {
    return () => undefined;
  }

  public signOutLocal(): Promise<void> {
    this.signOutCalls += 1;
    return Promise.resolve();
  }
}

class CurrentAccountStub implements CurrentAccountPort {
  public result: CurrentAccountLookupResult = { kind: 'OK', account: ACCOUNT };

  public getCurrentAccount(): Promise<CurrentAccountLookupResult> {
    return Promise.resolve(this.result);
  }
}

describe('captain SessionRestorationService preservation', () => {
  it('restores only the matching active captain account', async () => {
    const auth = new AuthSessionStub();
    const accounts = new CurrentAccountStub();

    await expect(new SessionRestorationService(auth, accounts).restore()).resolves.toEqual({
      status: 'AUTHENTICATED',
      account: ACCOUNT,
    });
    expect(auth.signOutCalls).toBe(0);
  });

  it('clears invalid, wrong-role, and identity-mismatched local sessions', async () => {
    const scenarios: CurrentAccountLookupResult[] = [
      { kind: 'INVALID_SESSION' },
      { kind: 'OK', account: { ...ACCOUNT, accountType: 'CUSTOMER' } },
      { kind: 'OK', account: { ...ACCOUNT, id: 'another-account' } },
    ];

    for (const result of scenarios) {
      const auth = new AuthSessionStub();
      const accounts = new CurrentAccountStub();
      accounts.result = result;
      const state = await new SessionRestorationService(auth, accounts).restore();

      expect(['SIGNED_OUT', 'ACCESS_DENIED']).toContain(state.status);
      expect(auth.signOutCalls).toBe(1);
    }
  });

  it('preserves the local session when the account check is unavailable', async () => {
    const auth = new AuthSessionStub();
    const accounts = new CurrentAccountStub();
    accounts.result = { kind: 'UNAVAILABLE' };

    await expect(new SessionRestorationService(auth, accounts).restore()).resolves.toEqual({
      status: 'UNAVAILABLE',
    });
    expect(auth.signOutCalls).toBe(0);
  });
});
