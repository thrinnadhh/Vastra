import type {
  AuthSessionPort,
  CurrentAccountPort,
  RestorableSession,
  SessionRestorationState,
  SessionRestorer,
} from './session-restoration.types';

const SIGNED_OUT_STATE: SessionRestorationState = Object.freeze({
  status: 'SIGNED_OUT',
});

const UNAVAILABLE_STATE: SessionRestorationState = Object.freeze({
  status: 'UNAVAILABLE',
});

export class SessionRestorationService implements SessionRestorer {
  public constructor(
    private readonly authSession: AuthSessionPort,
    private readonly currentAccount: CurrentAccountPort,
  ) {}

  public async restore(): Promise<SessionRestorationState> {
    try {
      const session = await this.authSession.getSession();
      return await this.restoreSession(session);
    } catch {
      return UNAVAILABLE_STATE;
    }
  }

  public async restoreSession(session: RestorableSession | null): Promise<SessionRestorationState> {
    if (session === null) {
      return SIGNED_OUT_STATE;
    }

    const result = await this.currentAccount.getCurrentAccount(session.accessToken);

    switch (result.kind) {
      case 'INVALID_SESSION':
        await this.signOutBestEffort();
        return SIGNED_OUT_STATE;

      case 'ACCESS_DENIED':
        return {
          status: 'ACCESS_DENIED',
          reason: 'FORBIDDEN',
        };

      case 'UNAVAILABLE':
        return UNAVAILABLE_STATE;

      case 'OK':
        if (result.account.id !== session.userId) {
          await this.signOutBestEffort();
          return {
            status: 'ACCESS_DENIED',
            reason: 'IDENTITY_MISMATCH',
          };
        }

        if (result.account.accountType !== 'CAPTAIN') {
          await this.signOutBestEffort();
          return {
            status: 'ACCESS_DENIED',
            reason: 'WRONG_ACCOUNT_TYPE',
          };
        }

        return {
          status: 'AUTHENTICATED',
          account: {
            ...result.account,
            accountType: 'CAPTAIN',
          },
        };
    }
  }

  private async signOutBestEffort(): Promise<void> {
    try {
      await this.authSession.signOutLocal();
    } catch {
      return;
    }
  }
}
