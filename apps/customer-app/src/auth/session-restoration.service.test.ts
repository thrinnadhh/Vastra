import { SessionRestorationService } from './session-restoration.service';
import type {
  AuthSessionEvent,
  AuthSessionPort,
  CurrentAccountLookupResult,
  CurrentAccountPort,
  RestorableSession,
} from './session-restoration.types';

const SESSION: RestorableSession = {
  userId: '10000000-0000-0000-0000-000000000001',
  accessToken: 'access-token',
};

class FakeAuthSession implements AuthSessionPort {
  public session: RestorableSession | null = SESSION;
  public getSessionError = false;
  public signOutCalls = 0;

  public getSession(): Promise<RestorableSession | null> {
    if (this.getSessionError) {
      return Promise.reject(new Error('storage unavailable'));
    }

    return Promise.resolve(this.session);
  }

  public onSessionChange(
    listener: (event: AuthSessionEvent, session: RestorableSession | null) => void,
  ): () => void {
    void listener;
    return () => undefined;
  }

  public signOutLocal(): Promise<void> {
    this.signOutCalls += 1;
    return Promise.resolve();
  }
}

class FakeCurrentAccount implements CurrentAccountPort {
  public result: CurrentAccountLookupResult = {
    kind: 'OK',
    account: {
      id: SESSION.userId,
      accountType: 'CUSTOMER',
      status: 'ACTIVE',
      fullName: 'Customer One',
      profileCompleted: true,
    },
  };

  public getCurrentAccount(accessToken: string): Promise<CurrentAccountLookupResult> {
    void accessToken;
    return Promise.resolve(this.result);
  }
}

describe('SessionRestorationService', () => {
  let authSession: FakeAuthSession;
  let currentAccount: FakeCurrentAccount;
  let service: SessionRestorationService;

  beforeEach(() => {
    authSession = new FakeAuthSession();
    currentAccount = new FakeCurrentAccount();
    service = new SessionRestorationService(authSession, currentAccount);
  });

  it('restores a valid customer session', async () => {
    await expect(service.restore()).resolves.toStrictEqual({
      status: 'AUTHENTICATED',
      account: {
        id: SESSION.userId,
        accountType: 'CUSTOMER',
        status: 'ACTIVE',
        fullName: 'Customer One',
        profileCompleted: true,
      },
    });
  });

  it('returns signed out when no persisted session exists', async () => {
    authSession.session = null;

    await expect(service.restore()).resolves.toStrictEqual({
      status: 'SIGNED_OUT',
    });
  });

  it('clears an invalid backend session', async () => {
    currentAccount.result = {
      kind: 'INVALID_SESSION',
    };

    await expect(service.restore()).resolves.toStrictEqual({
      status: 'SIGNED_OUT',
    });
    expect(authSession.signOutCalls).toBe(1);
  });

  it('rejects a session for another Vastra application', async () => {
    currentAccount.result = {
      kind: 'OK',
      account: {
        id: SESSION.userId,
        accountType: 'MERCHANT',
        status: 'ACTIVE',
        fullName: 'Merchant One',
        profileCompleted: true,
      },
    };

    await expect(service.restore()).resolves.toStrictEqual({
      status: 'ACCESS_DENIED',
      reason: 'WRONG_ACCOUNT_TYPE',
    });
    expect(authSession.signOutCalls).toBe(1);
  });

  it('rejects a mismatched authenticated identity', async () => {
    currentAccount.result = {
      kind: 'OK',
      account: {
        id: '20000000-0000-0000-0000-000000000001',
        accountType: 'CUSTOMER',
        status: 'ACTIVE',
        fullName: 'Another Customer',
        profileCompleted: true,
      },
    };

    await expect(service.restore()).resolves.toStrictEqual({
      status: 'ACCESS_DENIED',
      reason: 'IDENTITY_MISMATCH',
    });
    expect(authSession.signOutCalls).toBe(1);
  });

  it('preserves the stored session when the backend is unavailable', async () => {
    currentAccount.result = {
      kind: 'UNAVAILABLE',
    };

    await expect(service.restore()).resolves.toStrictEqual({
      status: 'UNAVAILABLE',
    });
    expect(authSession.signOutCalls).toBe(0);
  });

  it('returns a recoverable state when persisted storage cannot be read', async () => {
    authSession.getSessionError = true;

    await expect(service.restore()).resolves.toStrictEqual({
      status: 'UNAVAILABLE',
    });
  });
});
