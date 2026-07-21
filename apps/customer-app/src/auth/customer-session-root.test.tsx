import { act, fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import type { CustomerLaunchStore } from './customer-launch-store';
import { useCustomerSessionActions } from './customer-session-actions';
import { CustomerSessionRoot } from './customer-session-root';
import type {
  AuthSessionEvent,
  AuthSessionPort,
  RestorableSession,
  SessionRestorationState,
  SessionRestorer,
} from './session-restoration.types';

const SESSION: RestorableSession = {
  userId: '10000000-0000-0000-0000-000000000001',
  accessToken: 'access-token',
};

const AUTHENTICATED_STATE: SessionRestorationState = {
  status: 'AUTHENTICATED',
  account: {
    id: SESSION.userId,
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
    fullName: 'Customer One',
  },
};

class ObservableAuthSession implements AuthSessionPort {
  private listener:
    | ((event: AuthSessionEvent, session: RestorableSession | null) => void)
    | undefined;

  public signOutCalls = 0;

  public getSession(): Promise<RestorableSession | null> {
    return Promise.resolve(SESSION);
  }

  public onSessionChange(
    listener: (event: AuthSessionEvent, session: RestorableSession | null) => void,
  ): () => void {
    this.listener = listener;

    return () => {
      this.listener = undefined;
    };
  }

  public signOutLocal(): Promise<void> {
    this.signOutCalls += 1;
    this.listener?.('SIGNED_OUT', null);
    return Promise.resolve();
  }

  public emit(event: AuthSessionEvent, session: RestorableSession | null): void {
    this.listener?.(event, session);
  }
}

class SequencedRestorer implements SessionRestorer {
  public states: SessionRestorationState[] = [AUTHENTICATED_STATE];

  public restore(): Promise<SessionRestorationState> {
    const state = this.states.shift();

    if (state === undefined) {
      throw new TypeError('Expected a queued restoration state');
    }

    return Promise.resolve(state);
  }

  public restoreSession(session: RestorableSession | null): Promise<SessionRestorationState> {
    void session;
    return Promise.resolve(AUTHENTICATED_STATE);
  }
}

class LaunchStoreStub implements CustomerLaunchStore {
  public completed = false;

  public constructor(completed: boolean) {
    this.completed = completed;
  }

  public hasCompletedWelcome(): Promise<boolean> {
    return Promise.resolve(this.completed);
  }

  public markWelcomeCompleted(): Promise<void> {
    this.completed = true;
    return Promise.resolve();
  }
}

function SessionActionProbe() {
  const actions = useCustomerSessionActions();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign out of Vastra"
      onPress={() => {
        void actions.signOut();
      }}
    >
      <Text>{actions.account.fullName}</Text>
    </Pressable>
  );
}

describe('CustomerSessionRoot', () => {
  it('shows a deterministic splash and then renders authenticated content', async () => {
    const authSession = new ObservableAuthSession();
    const sessionRestorer = new SequencedRestorer();

    const { getByLabelText, findByText } = render(
      <CustomerSessionRoot authSession={authSession} sessionRestorer={sessionRestorer}>
        <Text>Authenticated customer home</Text>
      </CustomerSessionRoot>,
    );

    expect(getByLabelText('Restoring Vastra session')).toBeTruthy();
    expect(await findByText('Authenticated customer home')).toBeTruthy();
  });

  it('shows welcome once for a first launch without a session', async () => {
    const authSession = new ObservableAuthSession();
    const sessionRestorer = new SequencedRestorer();
    const launchStore = new LaunchStoreStub(false);
    sessionRestorer.states = [{ status: 'SIGNED_OUT' }];

    const { findByRole, findByText } = render(
      <CustomerSessionRoot
        authSession={authSession}
        launchStore={launchStore}
        sessionRestorer={sessionRestorer}
      >
        <Text>Authenticated customer home</Text>
      </CustomerSessionRoot>,
    );

    expect(await findByText('Fashion from shops around you')).toBeTruthy();
    fireEvent.press(await findByRole('button', { name: 'Continue to sign in' }));
    expect(await findByText('Sign in to continue')).toBeTruthy();
    expect(launchStore.completed).toBe(true);
  });

  it('shows the signed-out state after an auth sign-out event', async () => {
    const authSession = new ObservableAuthSession();
    const sessionRestorer = new SequencedRestorer();

    const { findByText } = render(
      <CustomerSessionRoot authSession={authSession} sessionRestorer={sessionRestorer}>
        <Text>Authenticated customer home</Text>
      </CustomerSessionRoot>,
    );

    expect(await findByText('Authenticated customer home')).toBeTruthy();

    act(() => {
      authSession.emit('SIGNED_OUT', null);
    });

    expect(await findByText('Sign in to continue')).toBeTruthy();
  });

  it('exposes local logout through the authenticated session boundary', async () => {
    const authSession = new ObservableAuthSession();
    const sessionRestorer = new SequencedRestorer();
    const { findByRole, findByText } = render(
      <CustomerSessionRoot authSession={authSession} sessionRestorer={sessionRestorer}>
        <SessionActionProbe />
      </CustomerSessionRoot>,
    );

    fireEvent.press(await findByRole('button', { name: 'Sign out of Vastra' }));

    expect(await findByText('Sign in to continue')).toBeTruthy();
    expect(authSession.signOutCalls).toBe(1);
  });

  it('retries a recoverable restoration failure', async () => {
    const authSession = new ObservableAuthSession();
    const sessionRestorer = new SequencedRestorer();
    sessionRestorer.states = [{ status: 'UNAVAILABLE' }, AUTHENTICATED_STATE];

    const { findByRole, findByText } = render(
      <CustomerSessionRoot authSession={authSession} sessionRestorer={sessionRestorer}>
        <Text>Authenticated customer home</Text>
      </CustomerSessionRoot>,
    );

    expect(await findByText('We could not restore your session')).toBeTruthy();

    fireEvent.press(
      await findByRole('button', {
        name: 'Retry session restoration',
      }),
    );

    expect(await findByText('Authenticated customer home')).toBeTruthy();
  });
});
