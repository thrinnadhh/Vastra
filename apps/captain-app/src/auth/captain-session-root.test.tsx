import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CaptainSessionRoot } from './captain-session-root';
import type {
  AuthSessionEvent,
  AuthSessionPort,
  RestorableSession,
  SessionRestorationState,
  SessionRestorer,
} from './session-restoration.types';

const SESSION: RestorableSession = {
  userId: '10000000-0000-4000-8000-000000000001',
  accessToken: 'captain-access-token',
};

const AUTHENTICATED_STATE: SessionRestorationState = {
  status: 'AUTHENTICATED',
  account: {
    id: SESSION.userId,
    accountType: 'CAPTAIN',
    status: 'ACTIVE',
    fullName: 'Captain One',
    availabilityStatus: 'OFFLINE',
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
    if (state === undefined) throw new TypeError('Expected a queued captain restoration state');
    return Promise.resolve(state);
  }

  public restoreSession(session: RestorableSession | null): Promise<SessionRestorationState> {
    void session;
    return Promise.resolve(AUTHENTICATED_STATE);
  }
}

describe('CaptainSessionRoot preservation', () => {
  it('shows restoration and then renders only authenticated captain content', async () => {
    const view = render(
      <CaptainSessionRoot
        authSession={new ObservableAuthSession()}
        sessionRestorer={new SequencedRestorer()}
      >
        <Text>Authenticated captain work</Text>
      </CaptainSessionRoot>,
    );

    expect(view.getByLabelText('Restoring Vastra session')).toBeTruthy();
    expect(await view.findByText('Authenticated captain work')).toBeTruthy();
  });

  it('removes protected content immediately after sign-out', async () => {
    const authSession = new ObservableAuthSession();
    const view = render(
      <CaptainSessionRoot authSession={authSession} sessionRestorer={new SequencedRestorer()}>
        <Text>Authenticated captain work</Text>
      </CaptainSessionRoot>,
    );
    expect(await view.findByText('Authenticated captain work')).toBeTruthy();

    act(() => {
      authSession.emit('SIGNED_OUT', null);
    });

    expect(await view.findByText('Sign in to continue')).toBeTruthy();
    expect(view.queryByText('Authenticated captain work')).toBeNull();
  });

  it('retries a recoverable session restoration failure', async () => {
    const restorer = new SequencedRestorer();
    restorer.states = [{ status: 'UNAVAILABLE' }, AUTHENTICATED_STATE];
    const view = render(
      <CaptainSessionRoot authSession={new ObservableAuthSession()} sessionRestorer={restorer}>
        <Text>Authenticated captain work</Text>
      </CaptainSessionRoot>,
    );
    expect(await view.findByText('We could not restore your session')).toBeTruthy();

    fireEvent.press(view.getByLabelText('Retry session restoration'));

    expect(await view.findByText('Authenticated captain work')).toBeTruthy();
  });
});
