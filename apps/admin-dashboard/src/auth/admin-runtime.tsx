'use client';

/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-deprecated, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-return, react-hooks/set-state-in-effect */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createApiClient, type FetchLike } from '@vastra/api-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import { ApiAdminPort } from '../admin/admin-api';
import { FixtureAdminPort } from '../admin/admin-fixture';
import type { AdminCapabilities, AdminPermission, AdminPort } from '../admin/admin-types';

interface RuntimeEnvironment {
  readonly apiBaseUrl: string;
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
}

type RuntimeState =
  | 'RESTORING'
  | 'SIGNED_OUT'
  | 'MFA_REQUIRED'
  | 'READY'
  | 'ACCESS_DENIED'
  | 'UNAVAILABLE'
  | 'NOT_CONFIGURED';

interface AdminRuntimeValue {
  readonly port: AdminPort;
  readonly capabilities: AdminCapabilities;
  readonly email: string;
  hasPermission(permission: AdminPermission): boolean;
  signOut(): Promise<void>;
  refreshCapabilities(): Promise<void>;
}

const AdminRuntimeContext = createContext<AdminRuntimeValue | null>(null);
const runtimeFetch = globalThis.fetch as unknown as FetchLike;

function readEnvironment(): RuntimeEnvironment | null {
  const apiBaseUrl = process.env['NEXT_PUBLIC_API_BASE_URL']?.trim();
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']?.trim();
  const supabasePublishableKey = process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']?.trim();
  if (!apiBaseUrl || !supabaseUrl || !supabasePublishableKey) return null;
  if (supabaseUrl.includes('example.invalid') || supabasePublishableKey.startsWith('replace-')) {
    return null;
  }
  return { apiBaseUrl, supabaseUrl, supabasePublishableKey };
}

function createAdminClient(environment: RuntimeEnvironment): SupabaseClient {
  return createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
}

function GatePanel({
  eyebrow,
  title,
  description,
  children,
  role,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children?: ReactNode;
  readonly role?: 'alert' | 'status';
}) {
  return (
    <main className="admin-gate" id="admin-main-content" tabIndex={-1}>
      <section aria-labelledby="admin-gate-title" className="admin-gate__panel" role={role}>
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="admin-gate-title">{title}</h1>
        <p className="admin-gate__description">{description}</p>
        {children}
      </section>
    </main>
  );
}

function SignInForm({
  busy,
  error,
  onSubmit,
}: {
  readonly busy: boolean;
  readonly error: string | null;
  readonly onSubmit: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit(email.trim(), password);
  };
  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        Admin email
        <input
          autoComplete="username"
          disabled={busy}
          onChange={(event) => setEmail(event.target.value)}
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
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary-action" disabled={busy} type="submit">
        {busy ? 'Signing in…' : 'Sign in securely'}
      </button>
    </form>
  );
}

interface TotpEnrollment {
  readonly factorId: string;
  readonly qrCode: string;
  readonly secret: string;
}

function MfaGate({
  client,
  onVerified,
  onSignOut,
}: {
  readonly client: SupabaseClient;
  readonly onVerified: () => Promise<void>;
  readonly onSignOut: () => Promise<void>;
}) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const response = await client.auth.mfa.listFactors();
    if (response.error !== null) {
      setMessage('MFA status could not be loaded. Retry or sign out.');
      setBusy(false);
      return;
    }
    const verified = response.data.totp.find((factor) => factor.status === 'verified');
    setFactorId(verified?.id ?? null);
    setBusy(false);
  }, [client]);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  const enroll = async () => {
    setBusy(true);
    setMessage(null);
    const response = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Vastra Admin',
    });
    if (response.error !== null) {
      setMessage('Authenticator enrollment could not be started.');
      setBusy(false);
      return;
    }
    setEnrollment({
      factorId: response.data.id,
      qrCode: response.data.totp.qr_code,
      secret: response.data.totp.secret,
    });
    setFactorId(response.data.id);
    setBusy(false);
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (factorId === null || !/^\d{6}$/u.test(code)) {
      setMessage('Enter the six-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const response = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (response.error !== null) {
      setMessage('The verification code was rejected. Check the current code and retry.');
      setBusy(false);
      return;
    }
    setCode('');
    await onVerified();
    setBusy(false);
  };

  return (
    <GatePanel
      description="Sensitive operations require an AAL2 session. Vastra never asks for a recovery code or stores your authenticator secret in application logs."
      eyebrow="Administrator verification"
      title="Complete multi-factor authentication"
    >
      {busy && factorId === null ? <p role="status">Checking authenticator factors…</p> : null}
      {!busy && factorId === null && enrollment === null ? (
        <button className="primary-action" onClick={() => void enroll()} type="button">
          Set up authenticator
        </button>
      ) : null}
      {enrollment === null ? null : (
        <div className="mfa-enrollment">
          <p>Scan this QR code with your authenticator app, then enter the current code.</p>
          {/* The QR data is returned by Supabase for the current authenticated enrollment only. */}
          {/* The QR payload is generated by Supabase at runtime and cannot use the Next image optimizer. */}
          <img
            alt="Authenticator enrollment QR code"
            height="192"
            src={enrollment.qrCode}
            width="192"
          />
          <details>
            <summary>Cannot scan the QR code?</summary>
            <p className="secret-value">{enrollment.secret}</p>
          </details>
        </div>
      )}
      {factorId === null ? null : (
        <form className="admin-form" onSubmit={verify}>
          <label>
            Six-digit authenticator code
            <input
              autoComplete="one-time-code"
              disabled={busy}
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/gu, ''))}
              pattern="[0-9]{6}"
              required
              value={code}
            />
          </label>
          {message === null ? null : (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}
          <button className="primary-action" disabled={busy} type="submit">
            {busy ? 'Verifying…' : 'Verify and open operations'}
          </button>
        </form>
      )}
      <div className="gate-actions">
        <button className="secondary-action" onClick={() => void loadFactors()} type="button">
          Retry factor check
        </button>
        <button className="text-action" onClick={() => void onSignOut()} type="button">
          Sign out
        </button>
      </div>
    </GatePanel>
  );
}

export function AdminRuntimeProvider({ children }: { readonly children: ReactNode }) {
  const fixture = process.env['NEXT_PUBLIC_ADMIN_E2E_FIXTURE'] === '1';
  const dependencies = useMemo(() => {
    if (fixture) return null;
    const environment = readEnvironment();
    if (environment === null) return undefined;
    const client = createAdminClient(environment);
    const api = createApiClient({
      baseUrl: environment.apiBaseUrl,
      fetch: runtimeFetch,
      accessTokenProvider: {
        async getAccessToken() {
          const response = await client.auth.getSession();
          if (response.error !== null) throw response.error;
          return response.data.session?.access_token ?? null;
        },
      },
      actor: 'admin',
    });
    return { environment, client, port: new ApiAdminPort(api) };
  }, [fixture]);

  const [state, setState] = useState<RuntimeState>(
    fixture ? 'READY' : dependencies === undefined ? 'NOT_CONFIGURED' : 'RESTORING',
  );
  const [capabilities, setCapabilities] = useState<AdminCapabilities | null>(
    fixture
      ? {
          assuranceLevel: 'aal2',
          permissions: [
            'operations.read',
            'operations.manage',
            'admin.dashboard.read',
            'admin.orders.read',
            'admin.orders.manage',
            'admin.merchants.read',
            'admin.merchants.manage',
            'admin.captains.read',
            'admin.captains.manage',
            'admin.audit.read',
          ],
          mfaRequiredForSensitiveOperations: true,
        }
      : null,
  );
  const [email, setEmail] = useState(fixture ? 'fixture.admin@vastra.test' : '');
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const operation = useRef(0);

  const fixturePort = useMemo(() => new FixtureAdminPort(), []);
  const port = fixture ? fixturePort : dependencies?.port;

  const refreshCapabilities = useCallback(async () => {
    if (port === undefined) {
      setState('NOT_CONFIGURED');
      return;
    }
    const operationId = ++operation.current;
    setState('RESTORING');
    const result = await port.capabilities();
    if (operation.current !== operationId) return;
    if (result.kind === 'FAILURE') {
      if (result.failure.kind === 'SESSION_EXPIRED') setState('SIGNED_OUT');
      else if (result.failure.kind === 'UNAUTHORIZED') setState('ACCESS_DENIED');
      else setState('UNAVAILABLE');
      return;
    }
    setCapabilities(result.data);
    setState(result.data.assuranceLevel === 'aal2' ? 'READY' : 'MFA_REQUIRED');
  }, [port]);

  useEffect(() => {
    if (fixture) return;
    if (dependencies === undefined) {
      setState('NOT_CONFIGURED');
      return;
    }
    if (dependencies === null) return;
    const { client } = dependencies;
    const restore = async () => {
      const response = await client.auth.getSession();
      if (response.error !== null) {
        setState('UNAVAILABLE');
        return;
      }
      if (response.data.session === null) {
        setState('SIGNED_OUT');
        return;
      }
      setEmail(response.data.session.user.email ?? 'Administrator');
      await refreshCapabilities();
    };
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || session === null) {
        operation.current += 1;
        setCapabilities(null);
        setEmail('');
        setState('SIGNED_OUT');
      } else {
        setEmail(session.user.email ?? 'Administrator');
      }
    });
    void restore();
    return () => {
      operation.current += 1;
      subscription.unsubscribe();
    };
  }, [dependencies, fixture, refreshCapabilities]);

  const signIn = async (requestedEmail: string, password: string) => {
    if (dependencies === undefined || dependencies === null) return;
    setSignInBusy(true);
    setSignInError(null);
    const response = await dependencies.client.auth.signInWithPassword({
      email: requestedEmail,
      password,
    });
    if (response.error !== null || response.data.session === null) {
      setSignInError('The email or password was not accepted.');
      setSignInBusy(false);
      return;
    }
    setEmail(response.data.user.email ?? requestedEmail);
    await refreshCapabilities();
    setSignInBusy(false);
  };

  const signOut = useCallback(async () => {
    if (fixture) return;
    if (dependencies === undefined || dependencies === null) return;
    operation.current += 1;
    await dependencies.client.auth.signOut({ scope: 'local' });
    setCapabilities(null);
    setState('SIGNED_OUT');
  }, [dependencies, fixture]);

  if (state === 'NOT_CONFIGURED') {
    return (
      <GatePanel
        description="Set the public API URL and public Supabase project values before starting the admin application."
        eyebrow="Configuration required"
        role="alert"
        title="Vastra Admin is not configured"
      />
    );
  }
  if (state === 'RESTORING') {
    return (
      <GatePanel
        description="Validating the current session, account permissions and assurance level."
        eyebrow="Secure session"
        role="status"
        title="Opening Vastra operations…"
      >
        <div className="loading-bar" />
      </GatePanel>
    );
  }
  if (state === 'SIGNED_OUT') {
    return (
      <GatePanel
        description="Use an active administrator account. Backend authorization and MFA remain authoritative."
        eyebrow="Vastra operations"
        title="Sign in to the admin control plane"
      >
        <SignInForm busy={signInBusy} error={signInError} onSubmit={signIn} />
      </GatePanel>
    );
  }
  if (state === 'ACCESS_DENIED') {
    return (
      <GatePanel
        description="The authenticated account is not an active Vastra administrator or lacks access to the capability bootstrap endpoint."
        eyebrow="Access denied"
        role="alert"
        title="Administrator access unavailable"
      >
        <button className="secondary-action" onClick={() => void signOut()} type="button">
          Sign out
        </button>
      </GatePanel>
    );
  }
  if (state === 'UNAVAILABLE') {
    return (
      <GatePanel
        description="The saved sign-in was not removed. Check connectivity and retry the authoritative capability check."
        eyebrow="Operations unavailable"
        role="alert"
        title="The admin session could not be verified"
      >
        <div className="gate-actions">
          <button
            className="primary-action"
            onClick={() => void refreshCapabilities()}
            type="button"
          >
            Retry
          </button>
          <button className="text-action" onClick={() => void signOut()} type="button">
            Sign out
          </button>
        </div>
      </GatePanel>
    );
  }
  if (state === 'MFA_REQUIRED') {
    if (dependencies === undefined || dependencies === null) return null;
    return (
      <MfaGate client={dependencies.client} onSignOut={signOut} onVerified={refreshCapabilities} />
    );
  }
  if (capabilities === null || port === undefined) return null;

  const value: AdminRuntimeValue = {
    port,
    capabilities,
    email,
    hasPermission: (permission) => capabilities.permissions.includes(permission),
    signOut,
    refreshCapabilities,
  };
  return <AdminRuntimeContext.Provider value={value}>{children}</AdminRuntimeContext.Provider>;
}

export function useAdminRuntime(): AdminRuntimeValue {
  const context = useContext(AdminRuntimeContext);
  if (context === null) throw new TypeError('Admin runtime is unavailable');
  return context;
}
