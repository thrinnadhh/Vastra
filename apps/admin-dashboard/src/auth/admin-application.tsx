'use client';

import { createApiClient, type FetchRequestInitLike } from '@vastra/api-client';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';

import {
  AdminEnvironmentError,
  readAdminEnvironment,
  type AdminEnvironment,
} from './admin-environment';
import { resolveAdminAccess } from './admin-access';
import { AdminOperationsScreen, type AdminApiSession } from '../operations/admin-operations.screen';

type SessionState =
  | Readonly<{ kind: 'CHECKING' }>
  | Readonly<{ kind: 'SIGNED_OUT'; message: string | null }>
  | Readonly<{ kind: 'MFA_REQUIRED'; factorId: string | null; message: string | null }>
  | Readonly<{ kind: 'AUTHENTICATED'; session: Session }>
  | Readonly<{ kind: 'ACCESS_DENIED' }>
  | Readonly<{ kind: 'UNAVAILABLE' }>;

type BootstrapState =
  | Readonly<{ kind: 'CHECKING' }>
  | Readonly<{ kind: 'UNAVAILABLE' }>
  | Readonly<{
      kind: 'READY';
      environment: AdminEnvironment;
      client: SupabaseClient;
    }>;

const browserFetch = (url: string, init: FetchRequestInitLike) => fetch(url, init as RequestInit);

function LoadingSession(): React.JSX.Element {
  return (
    <section aria-labelledby="session-check-title" className="admin-auth">
      <div className="admin-auth__panel">
        <p className="operations-state__eyebrow">Vastra operations</p>
        <h1 id="session-check-title">Checking secure admin session</h1>
        <p aria-live="polite" role="status">
          Verifying account status, role, and multi-factor assurance.
        </p>
      </div>
    </section>
  );
}

function ConfigurationUnavailable(): React.JSX.Element {
  return (
    <section aria-labelledby="configuration-title" className="admin-auth" role="alert">
      <div className="admin-auth__panel">
        <p className="operations-state__eyebrow">Configuration required</p>
        <h1 id="configuration-title">Admin sign-in is unavailable</h1>
        <p>
          Public API and authentication settings are missing or unsafe. No credentials were
          submitted.
        </p>
      </div>
    </section>
  );
}

function SignedOutForm({
  busy,
  message,
  onSubmit,
}: {
  readonly busy: boolean;
  readonly message: string | null;
  readonly onSubmit: (email: string, password: string) => void;
}): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void => {
    event.preventDefault();
    onSubmit(email.trim(), password);
  };

  return (
    <section aria-labelledby="sign-in-title" className="admin-auth">
      <form className="admin-auth__panel" onSubmit={submit}>
        <p className="operations-state__eyebrow">Restricted operations access</p>
        <h1 id="sign-in-title">Secure admin sign in</h1>
        <p>Use an approved administrator account. Multi-factor verification is mandatory.</p>
        <label>
          Admin email
          <input
            autoComplete="username"
            disabled={busy}
            inputMode="email"
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            disabled={busy}
            minLength={8}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            required
            type="password"
            value={password}
          />
        </label>
        {message === null ? null : (
          <p aria-live="assertive" className="admin-auth__error" role="alert">
            {message}
          </p>
        )}
        <button className="operations-button" disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in securely'}
        </button>
      </form>
    </section>
  );
}

function MfaForm({
  available,
  busy,
  message,
  onSignOut,
  onSubmit,
}: {
  readonly available: boolean;
  readonly busy: boolean;
  readonly message: string | null;
  readonly onSignOut: () => void;
  readonly onSubmit: (code: string) => void;
}): React.JSX.Element {
  const [code, setCode] = useState('');

  const submit = (event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void => {
    event.preventDefault();
    onSubmit(code.trim());
  };

  return (
    <section aria-labelledby="mfa-title" className="admin-auth">
      <form className="admin-auth__panel" onSubmit={submit}>
        <p className="operations-state__eyebrow">Second factor required</p>
        <h1 id="mfa-title">Verify administrator access</h1>
        <p>
          {available
            ? 'Enter the current six-digit code from your approved authenticator.'
            : 'No verified authenticator is available for this account. Contact the administrator.'}
        </p>
        {available ? (
          <label>
            Authentication code
            <input
              autoComplete="one-time-code"
              disabled={busy}
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              onChange={(event) => {
                setCode(event.target.value.replaceAll(/\D/gu, '').slice(0, 6));
              }}
              pattern="[0-9]{6}"
              required
              value={code}
            />
          </label>
        ) : null}
        {message === null ? null : (
          <p aria-live="assertive" className="admin-auth__error" role="alert">
            {message}
          </p>
        )}
        <div className="admin-auth__actions">
          {available ? (
            <button className="operations-button" disabled={busy} type="submit">
              {busy ? 'Verifying…' : 'Verify MFA'}
            </button>
          ) : null}
          <button
            className="operations-button operations-button--secondary"
            disabled={busy}
            onClick={onSignOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </form>
    </section>
  );
}

function SessionFailure({
  denied,
  onRetry,
  onSignOut,
}: {
  readonly denied: boolean;
  readonly onRetry: () => void;
  readonly onSignOut: () => void;
}): React.JSX.Element {
  return (
    <section aria-labelledby="session-error-title" className="admin-auth" role="alert">
      <div className="admin-auth__panel">
        <p className="operations-state__eyebrow">Secure access</p>
        <h1 id="session-error-title">
          {denied ? 'Admin access denied' : 'Session verification unavailable'}
        </h1>
        <p>
          {denied
            ? 'This account cannot access Vastra operations.'
            : 'The account could not be verified. The session has not been discarded.'}
        </p>
        <div className="admin-auth__actions">
          {denied ? null : (
            <button className="operations-button" onClick={onRetry} type="button">
              Retry verification
            </button>
          )}
          <button
            className="operations-button operations-button--secondary"
            onClick={onSignOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </div>
    </section>
  );
}

async function getVerifiedTotpFactor(client: SupabaseClient): Promise<string | null> {
  const response = await client.auth.mfa.listFactors();
  if (response.error !== null) throw response.error;
  return response.data.totp[0]?.id ?? null;
}

function AdminSessionGate({
  client,
  environment,
}: {
  readonly client: SupabaseClient;
  readonly environment: AdminEnvironment;
}): React.JSX.Element {
  const [state, setState] = useState<SessionState>({ kind: 'CHECKING' });
  const [busy, setBusy] = useState(false);
  const operation = useRef(0);

  const verifySession = useCallback(
    async (session: Session | null): Promise<void> => {
      const operationId = ++operation.current;
      if (session === null) {
        setState({ kind: 'SIGNED_OUT', message: null });
        return;
      }
      setState({ kind: 'CHECKING' });
      try {
        const apiClient = createApiClient({
          baseUrl: environment.apiBaseUrl,
          fetch: browserFetch,
          accessTokenProvider: { getAccessToken: () => session.access_token },
          actor: 'admin',
        });
        const [account, assurance] = await Promise.all([
          apiClient.request('getCurrentAccount', {}),
          client.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);
        if (assurance.error !== null) throw assurance.error;
        const currentLevel = assurance.data.currentLevel === 'aal2' ? 'aal2' : 'aal1';
        const decision = resolveAdminAccess(account.data, session.user.id, currentLevel);
        if (operation.current !== operationId) return;

        if (decision === 'AUTHENTICATED') {
          setState({ kind: 'AUTHENTICATED', session });
          return;
        }
        if (decision === 'ACCESS_DENIED') {
          setState({ kind: 'ACCESS_DENIED' });
          return;
        }
        const factorId = await getVerifiedTotpFactor(client);
        if (operation.current === operationId) {
          setState({ kind: 'MFA_REQUIRED', factorId, message: null });
        }
      } catch {
        if (operation.current === operationId) setState({ kind: 'UNAVAILABLE' });
      }
    },
    [client, environment.apiBaseUrl],
  );

  const restore = useCallback((): void => {
    const operationId = ++operation.current;
    setState({ kind: 'CHECKING' });
    void client.auth.getSession().then(
      ({ data, error }) => {
        if (operation.current !== operationId) return;
        if (error !== null) {
          setState({ kind: 'UNAVAILABLE' });
          return;
        }
        void verifySession(data.session);
      },
      () => {
        if (operation.current === operationId) setState({ kind: 'UNAVAILABLE' });
      },
    );
  }, [client, verifySession]);

  useEffect(() => {
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        operation.current += 1;
        setState({ kind: 'SIGNED_OUT', message: null });
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        queueMicrotask(() => void verifySession(session));
      }
    });
    queueMicrotask(restore);
    return () => {
      operation.current += 1;
      subscription.unsubscribe();
    };
  }, [client, restore, verifySession]);

  const signIn = useCallback(
    (email: string, password: string): void => {
      if (busy) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || password.length < 8) {
        setState({
          kind: 'SIGNED_OUT',
          message: 'Enter a valid administrator email and password.',
        });
        return;
      }
      setBusy(true);
      void client.auth.signInWithPassword({ email, password }).then(
        ({ data, error }) => {
          setBusy(false);
          if (error !== null) {
            setState({
              kind: 'SIGNED_OUT',
              message: 'Sign-in failed. Check your credentials and try again.',
            });
            return;
          }
          void verifySession(data.session);
        },
        () => {
          setBusy(false);
          setState({
            kind: 'SIGNED_OUT',
            message: 'Sign-in is temporarily unavailable. Try again.',
          });
        },
      );
    },
    [busy, client.auth, verifySession],
  );

  const signOut = useCallback((): void => {
    operation.current += 1;
    setBusy(false);
    void client.auth.signOut({ scope: 'local' });
    setState({ kind: 'SIGNED_OUT', message: null });
  }, [client.auth]);

  const verifyMfa = useCallback(
    (code: string): void => {
      if (busy || state.kind !== 'MFA_REQUIRED' || state.factorId === null) return;
      const factorId = state.factorId;
      if (!/^\d{6}$/u.test(code)) {
        setState({ ...state, message: 'Enter the six-digit authentication code.' });
        return;
      }
      setBusy(true);
      void client.auth.mfa
        .challenge({ factorId })
        .then(async (challenge) => {
          if (challenge.error !== null) throw challenge.error;
          const verification = await client.auth.mfa.verify({
            factorId,
            challengeId: challenge.data.id,
            code,
          });
          if (verification.error !== null) throw verification.error;
          const session = await client.auth.getSession();
          if (session.error !== null || session.data.session === null) {
            throw session.error ?? new Error('SESSION_UNAVAILABLE');
          }
          await verifySession(session.data.session);
        })
        .catch(() => {
          setState({
            kind: 'MFA_REQUIRED',
            factorId,
            message: 'Verification failed. Check the current code and try again.',
          });
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [busy, client.auth, state, verifySession],
  );

  const apiSession = useMemo<AdminApiSession>(
    () => ({
      apiBaseUrl: environment.apiBaseUrl,
      async getAccessToken(): Promise<string | null> {
        const response = await client.auth.getSession();
        if (response.error !== null) throw response.error;
        return response.data.session?.access_token ?? null;
      },
    }),
    [client.auth, environment.apiBaseUrl],
  );

  if (state.kind === 'CHECKING') return <LoadingSession />;
  if (state.kind === 'SIGNED_OUT') {
    return <SignedOutForm busy={busy} message={state.message} onSubmit={signIn} />;
  }
  if (state.kind === 'MFA_REQUIRED') {
    return (
      <MfaForm
        available={state.factorId !== null}
        busy={busy}
        message={state.message}
        onSignOut={signOut}
        onSubmit={verifyMfa}
      />
    );
  }
  if (state.kind === 'ACCESS_DENIED' || state.kind === 'UNAVAILABLE') {
    return (
      <SessionFailure
        denied={state.kind === 'ACCESS_DENIED'}
        onRetry={restore}
        onSignOut={signOut}
      />
    );
  }

  return (
    <>
      <div className="admin-session-bar">
        <span role="status">MFA-verified operations session</span>
        <button
          className="operations-button operations-button--secondary"
          onClick={signOut}
          type="button"
        >
          Sign out
        </button>
      </div>
      <AdminOperationsScreen onSessionExpired={signOut} session={apiSession} />
    </>
  );
}

export function AdminApplication(): React.JSX.Element {
  const [bootstrap, setBootstrap] = useState<BootstrapState>({ kind: 'CHECKING' });

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const environment = readAdminEnvironment({
          NEXT_PUBLIC_API_BASE_URL: process.env['NEXT_PUBLIC_API_BASE_URL'],
          NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
        });
        const client = createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: false,
            detectSessionInUrl: false,
          },
        });
        setBootstrap({ kind: 'READY', environment, client });
      } catch (error: unknown) {
        if (error instanceof AdminEnvironmentError) {
          setBootstrap({ kind: 'UNAVAILABLE' });
          return;
        }
        throw error;
      }
    });
  }, []);

  if (bootstrap.kind === 'CHECKING') return <LoadingSession />;
  if (bootstrap.kind === 'UNAVAILABLE') return <ConfigurationUnavailable />;
  return <AdminSessionGate client={bootstrap.client} environment={bootstrap.environment} />;
}
