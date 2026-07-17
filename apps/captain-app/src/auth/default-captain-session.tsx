import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HttpCurrentAccountClient } from './current-account-client';
import { CaptainSessionRoot } from './captain-session-root';
import {
  CaptainMobileEnvironmentError,
  readCaptainMobileEnvironment,
} from './mobile-environment';
import { SessionRestorationService } from './session-restoration.service';
import {
  createCaptainSupabaseClient,
  startSupabaseAuthLifecycle,
  SupabaseAuthSessionAdapter,
  type CaptainSupabaseClient,
} from './supabase-session-adapter';
import type { AuthSessionPort, SessionRestorer } from './session-restoration.types';
import { CaptainApiSessionProvider } from './captain-api-session';

interface CaptainSessionAppProps {
  readonly children: ReactNode;
}

interface CaptainSessionDependencies {
  readonly apiBaseUrl: string;
  readonly client: CaptainSupabaseClient;
  readonly authSession: AuthSessionPort;
  readonly sessionRestorer: SessionRestorer;
}

type DependencyResult =
  | {
      readonly kind: 'READY';
      readonly dependencies: CaptainSessionDependencies;
    }
  | {
      readonly kind: 'CONFIGURATION_ERROR';
    };

function createDependencies(): DependencyResult {
  try {
    const environment = readCaptainMobileEnvironment();
    const client = createCaptainSupabaseClient(environment);
    const authSession = new SupabaseAuthSessionAdapter(client);
    const currentAccount = new HttpCurrentAccountClient(environment.apiBaseUrl);

    return {
      kind: 'READY',
      dependencies: {
        apiBaseUrl: environment.apiBaseUrl,
        client,
        authSession,
        sessionRestorer: new SessionRestorationService(authSession, currentAccount),
      },
    };
  } catch (error: unknown) {
    if (error instanceof CaptainMobileEnvironmentError) {
      return {
        kind: 'CONFIGURATION_ERROR',
      };
    }

    throw error;
  }
}

function ConfiguredCaptainSessionApp({
  dependencies,
  children,
}: {
  readonly dependencies: CaptainSessionDependencies;
  readonly children: ReactNode;
}) {
  useEffect(() => startSupabaseAuthLifecycle(dependencies.client), [dependencies.client]);

  return (
    <CaptainApiSessionProvider
      apiBaseUrl={dependencies.apiBaseUrl}
      authSession={dependencies.authSession}
    >
      <CaptainSessionRoot
        authSession={dependencies.authSession}
        sessionRestorer={dependencies.sessionRestorer}
      >
        {children}
      </CaptainSessionRoot>
    </CaptainApiSessionProvider>
  );
}

export function CaptainSessionApp({ children }: CaptainSessionAppProps) {
  const result = useMemo(() => createDependencies(), []);

  if (result.kind === 'CONFIGURATION_ERROR') {
    return (
      <View style={styles.configurationScreen}>
        <Text accessibilityRole="header" style={styles.configurationTitle}>
          Vastra is not configured
        </Text>

        <Text style={styles.configurationDescription}>
          The captain app is missing its public API or Supabase configuration.
        </Text>
      </View>
    );
  }

  return (
    <ConfiguredCaptainSessionApp dependencies={result.dependencies}>
      {children}
    </ConfiguredCaptainSessionApp>
  );
}

const styles = StyleSheet.create({
  configurationScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#FFF8F2',
  },
  configurationTitle: {
    color: '#241B16',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  configurationDescription: {
    maxWidth: 360,
    marginTop: 12,
    color: '#665A52',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
