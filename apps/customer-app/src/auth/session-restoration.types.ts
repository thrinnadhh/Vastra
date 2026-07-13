export const MOBILE_ACCOUNT_TYPES = ['CUSTOMER', 'MERCHANT', 'CAPTAIN', 'ADMIN'] as const;
export type MobileAccountType = (typeof MOBILE_ACCOUNT_TYPES)[number];

export interface RestorableSession {
  readonly userId: string;
  readonly accessToken: string;
}

export type AuthSessionEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'
  | 'MFA_CHALLENGE_VERIFIED'
  | 'UNKNOWN';

export interface AuthSessionPort {
  getSession(): Promise<RestorableSession | null>;
  onSessionChange(
    listener: (event: AuthSessionEvent, session: RestorableSession | null) => void,
  ): () => void;
  signOutLocal(): Promise<void>;
}

export interface CurrentAccount {
  readonly id: string;
  readonly accountType: MobileAccountType;
  readonly status: 'ACTIVE';
  readonly fullName: string | null;
}

export type CurrentAccountLookupResult =
  | {
      readonly kind: 'OK';
      readonly account: CurrentAccount;
    }
  | {
      readonly kind: 'INVALID_SESSION';
    }
  | {
      readonly kind: 'ACCESS_DENIED';
    }
  | {
      readonly kind: 'UNAVAILABLE';
    };

export interface CurrentAccountPort {
  getCurrentAccount(accessToken: string): Promise<CurrentAccountLookupResult>;
}

export type SessionAccessDeniedReason = 'FORBIDDEN' | 'IDENTITY_MISMATCH' | 'WRONG_ACCOUNT_TYPE';

export type SessionRestorationState =
  | {
      readonly status: 'RESTORING';
    }
  | {
      readonly status: 'SIGNED_OUT';
    }
  | {
      readonly status: 'AUTHENTICATED';
      readonly account: CurrentAccount & {
        readonly accountType: 'CUSTOMER';
      };
    }
  | {
      readonly status: 'ACCESS_DENIED';
      readonly reason: SessionAccessDeniedReason;
    }
  | {
      readonly status: 'UNAVAILABLE';
    };

export interface SessionRestorer {
  restore(): Promise<SessionRestorationState>;
  restoreSession(session: RestorableSession | null): Promise<SessionRestorationState>;
}
