import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

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
    ((event: AuthSessionEvent, session: RestorableSession | null) => void) | undefined;

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

describe('CustomerSessionRoot', () => {
  it('shows a loading state and then renders authenticated content', async () => {
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
