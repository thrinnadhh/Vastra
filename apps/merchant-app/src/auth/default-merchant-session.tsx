import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import 'react-native-url-polyfill/auto';

import { MerchantApiSessionProvider } from './merchant-api-session';
import {
  MerchantMobileEnvironmentError,
  readMerchantMobileEnvironment,
  type MerchantMobileEnvironment,
} from './merchant-environment';

type SessionState = 'RESTORING' | 'AUTHENTICATED' | 'SIGNED_OUT' | 'ACCESS_DENIED' | 'UNAVAILABLE';

function createMerchantClient(environment: MerchantMobileEnvironment) {
  return createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
    auth: {
      ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

async function verifyMerchantAccount(
  environment: MerchantMobileEnvironment,
  session: Session,
): Promise<SessionState> {
  try {
    const response = await fetch(`${environment.apiBaseUrl}/me`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${session.access_token}` },
    });
    if (response.status === 401) return 'SIGNED_OUT';
    if (response.status === 403 || !response.ok)
      return response.status === 403 ? 'ACCESS_DENIED' : 'UNAVAILABLE';
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'UNAVAILABLE';
    const data = (body as Record<string, unknown>)['data'];
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return 'UNAVAILABLE';
    const account = data as Record<string, unknown>;
    return account['id'] === session.user.id &&
      account['accountType'] === 'MERCHANT' &&
      account['status'] === 'ACTIVE'
      ? 'AUTHENTICATED'
      : 'ACCESS_DENIED';
  } catch {
    return 'UNAVAILABLE';
  }
}

function SessionStatus({
  state,
  onRetry,
}: {
  readonly state: Exclude<SessionState, 'AUTHENTICATED'>;
  readonly onRetry: () => void;
}) {
  const copy = {
    RESTORING: ['Restoring merchant session', 'Checking your secure Vastra merchant sign-in.'],
    SIGNED_OUT: ['Sign in to continue', 'Your saved merchant session is not available.'],
    ACCESS_DENIED: ['Merchant access unavailable', 'This account cannot manage a Vastra shop.'],
    UNAVAILABLE: [
      'Session check unavailable',
      'Check your connection and retry. Your saved sign-in has not been removed.',
    ],
  }[state];
  return (
    <View style={styles.screen}>
      {state === 'RESTORING' ? (
        <ActivityIndicator accessibilityLabel="Restoring merchant session" size="large" />
      ) : null}
      <Text accessibilityRole="header" style={styles.title}>
        {copy[0]}
      </Text>
      <Text style={styles.description}>{copy[1]}</Text>
      {state === 'UNAVAILABLE' ? (
        <Pressable
          accessibilityLabel="Retry merchant session restoration"
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.action}
        >
          <Text style={styles.actionText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MerchantSessionGate({
  environment,
  client,
  children,
}: {
  readonly environment: MerchantMobileEnvironment;
  readonly client: SupabaseClient;
  readonly children: ReactNode;
}) {
  const [state, setState] = useState<SessionState>('RESTORING');
  const operation = useRef(0);

  const restoreSession = useCallback(
    async (session: Session | null): Promise<void> => {
      const operationId = ++operation.current;
      if (session === null) {
        setState('SIGNED_OUT');
        return;
      }
      setState('RESTORING');
      const next = await verifyMerchantAccount(environment, session);
      if (operation.current === operationId) setState(next);
    },
    [environment],
  );

  const restore = useCallback(() => {
    const operationId = ++operation.current;
    setState('RESTORING');
    void client.auth.getSession().then(
      ({ data, error }) => {
        if (operation.current !== operationId) return;
        if (error !== null) {
          setState('UNAVAILABLE');
          return;
        }
        void restoreSession(data.session);
      },
      () => {
        if (operation.current === operationId) setState('UNAVAILABLE');
      },
    );
  }, [client, restoreSession]);

  useEffect(() => {
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      void restoreSession(session);
    });
    void Promise.resolve().then(restore);
    return () => {
      operation.current += 1;
      subscription.unsubscribe();
    };
  }, [client, restore, restoreSession]);

  if (state !== 'AUTHENTICATED') return <SessionStatus onRetry={restore} state={state} />;
  return <>{children}</>;
}

export function MerchantSessionApp({ children }: { readonly children: ReactNode }) {
  const dependencies = useMemo(() => {
    try {
      const environment = readMerchantMobileEnvironment();
      return { environment, client: createMerchantClient(environment) };
    } catch (error: unknown) {
      if (error instanceof MerchantMobileEnvironmentError) return null;
      throw error;
    }
  }, []);

  useEffect(() => {
    if (dependencies === null || Platform.OS === 'web') return;
    const update = (state: string) => {
      if (state === 'active') void dependencies.client.auth.startAutoRefresh();
      else void dependencies.client.auth.stopAutoRefresh();
    };
    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => {
      subscription.remove();
      void dependencies.client.auth.stopAutoRefresh();
    };
  }, [dependencies]);

  if (dependencies === null) {
    return (
      <View style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          Vastra Merchant is not configured
        </Text>
        <Text style={styles.description}>Public API and Supabase settings are required.</Text>
      </View>
    );
  }

  return (
    <MerchantApiSessionProvider
      apiBaseUrl={dependencies.environment.apiBaseUrl}
      client={dependencies.client}
    >
      <MerchantSessionGate client={dependencies.client} environment={dependencies.environment}>
        {children}
      </MerchantSessionGate>
    </MerchantApiSessionProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#FFF8F2',
  },
  title: { marginTop: 18, color: '#241B16', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  description: {
    maxWidth: 360,
    marginTop: 12,
    color: '#665A52',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  action: {
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#8E3B46',
  },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
