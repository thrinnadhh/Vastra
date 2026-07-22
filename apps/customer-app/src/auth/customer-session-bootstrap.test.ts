import type { CustomerLaunchStore } from './customer-launch-store';
import { bootstrapCustomerSession } from './customer-session-bootstrap';
import type { SessionRestorationState, SessionRestorer } from './session-restoration.types';

class LaunchStoreStub implements CustomerLaunchStore {
  public constructor(private readonly completed: boolean) {}

  public hasCompletedWelcome(): Promise<boolean> {
    return Promise.resolve(this.completed);
  }

  public markWelcomeCompleted(): Promise<void> {
    return Promise.resolve();
  }
}

class RestorerStub implements SessionRestorer {
  public constructor(private readonly state: SessionRestorationState) {}

  public restore(): Promise<SessionRestorationState> {
    return Promise.resolve(this.state);
  }

  public restoreSession(): Promise<SessionRestorationState> {
    return Promise.resolve(this.state);
  }
}

describe('bootstrapCustomerSession', () => {
  it('shows welcome only for a first launch without a returning session', async () => {
    await expect(
      bootstrapCustomerSession(
        new LaunchStoreStub(false),
        new RestorerStub({ status: 'SIGNED_OUT' }),
      ),
    ).resolves.toEqual({
      status: 'WELCOME',
      session: { status: 'SIGNED_OUT' },
    });
  });

  it('lets a valid returning session bypass first-launch welcome', async () => {
    const session: SessionRestorationState = {
      status: 'AUTHENTICATED',
      account: {
        id: 'customer-id',
        accountType: 'CUSTOMER',
        status: 'ACTIVE',
        fullName: 'Customer One',
        profileCompleted: true,
      },
    };

    await expect(
      bootstrapCustomerSession(new LaunchStoreStub(false), new RestorerStub(session)),
    ).resolves.toEqual({ status: 'READY', session });
  });

  it('keeps storage and restoration failures recoverable', async () => {
    const failingStore: CustomerLaunchStore = {
      hasCompletedWelcome: () => Promise.reject(new Error('storage unavailable')),
      markWelcomeCompleted: () => Promise.resolve(),
    };

    await expect(
      bootstrapCustomerSession(failingStore, new RestorerStub({ status: 'SIGNED_OUT' })),
    ).resolves.toEqual({ status: 'UNAVAILABLE' });
  });
});
