import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useCustomerApiClient } from '../api/use-customer-api-client';
import { ApiCustomerProfileSetupAdapter } from '../profile/api-customer-profile-setup.adapter';
import { CustomerProfileSetupScreen } from '../profile/customer-profile-setup.screen';
import { AsyncStorageCustomerLaunchStore } from './async-storage-customer-launch-store';
import { CustomerApiSessionProvider } from './customer-api-session';
import { CustomerPhoneOtpScreen } from './customer-phone-otp.screen';
import { HttpCurrentAccountClient } from './current-account-client';
import type { PhoneOtpPort } from './phone-otp.types';
import {
  CustomerSessionRoot,
  type CustomerProfileSetupComponentProps,
} from './customer-session-root';
import {
  CustomerMobileEnvironmentError,
  readCustomerMobileEnvironment,
} from './mobile-environment';
import { SessionRestorationService } from './session-restoration.service';
import type { AuthSessionPort, SessionRestorer } from './session-restoration.types';
import {
  createCustomerSupabaseClient,
  startSupabaseAuthLifecycle,
  SupabaseAuthSessionAdapter,
  type CustomerSupabaseClient,
} from './supabase-session-adapter';
import { SupabasePhoneOtpAdapter } from './supabase-phone-otp.adapter';

interface CustomerSessionAppProps {
  readonly signedOutContent?: ReactNode;
  readonly children: ReactNode;
}

interface CustomerSessionDependencies {
  readonly apiBaseUrl: string;
  readonly client: CustomerSupabaseClient;
  readonly authSession: AuthSessionPort;
  readonly sessionRestorer: SessionRestorer;
  readonly launchStore: AsyncStorageCustomerLaunchStore;
  readonly phoneOtpPort: PhoneOtpPort;
}

type DependencyResult =
  | {
      readonly kind: 'READY';
      readonly dependencies: CustomerSessionDependencies;
    }
  | {
      readonly kind: 'CONFIGURATION_ERROR';
    };

function createDependencies(): DependencyResult {
  try {
    const environment = readCustomerMobileEnvironment();
    const client = createCustomerSupabaseClient(environment);
    const authSession = new SupabaseAuthSessionAdapter(client);
    const currentAccount = new HttpCurrentAccountClient(environment.apiBaseUrl);

    return {
      kind: 'READY',
      dependencies: {
        apiBaseUrl: environment.apiBaseUrl,
        client,
        authSession,
        sessionRestorer: new SessionRestorationService(authSession, currentAccount),
        launchStore: new AsyncStorageCustomerLaunchStore(),
        phoneOtpPort: new SupabasePhoneOtpAdapter(client),
      },
    };
  } catch (error: unknown) {
    if (error instanceof CustomerMobileEnvironmentError) {
      return {
        kind: 'CONFIGURATION_ERROR',
      };
    }

    throw error;
  }
}

function DefaultCustomerProfileSetup({ account, onCompleted }: CustomerProfileSetupComponentProps) {
  const apiClient = useCustomerApiClient();
  const profilePort = useMemo(() => new ApiCustomerProfileSetupAdapter(apiClient), [apiClient]);

  return (
    <CustomerProfileSetupScreen
      initialFullName={account.fullName ?? ''}
      onCompleted={onCompleted}
      profilePort={profilePort}
    />
  );
}

function ConfiguredCustomerSessionApp({
  dependencies,
  signedOutContent,
  children,
}: {
  readonly dependencies: CustomerSessionDependencies;
  readonly signedOutContent?: ReactNode;
  readonly children: ReactNode;
}) {
  useEffect(() => startSupabaseAuthLifecycle(dependencies.client), [dependencies.client]);

  const resolvedSignedOutContent = signedOutContent ?? (
    <CustomerPhoneOtpScreen otpPort={dependencies.phoneOtpPort} />
  );

  return (
    <CustomerApiSessionProvider
      apiBaseUrl={dependencies.apiBaseUrl}
      authSession={dependencies.authSession}
    >
      <CustomerSessionRoot
        authSession={dependencies.authSession}
        launchStore={dependencies.launchStore}
        ProfileSetupComponent={DefaultCustomerProfileSetup}
        sessionRestorer={dependencies.sessionRestorer}
        signedOutContent={resolvedSignedOutContent}
      >
        {children}
      </CustomerSessionRoot>
    </CustomerApiSessionProvider>
  );
}

export function CustomerSessionApp({ signedOutContent, children }: CustomerSessionAppProps) {
  const result = useMemo(() => createDependencies(), []);

  if (result.kind === 'CONFIGURATION_ERROR') {
    return (
      <View style={styles.configurationScreen}>
        <Text accessibilityRole="header" style={styles.configurationTitle}>
          Vastra is not configured
        </Text>

        <Text style={styles.configurationDescription}>
          The customer app is missing its public API or Supabase configuration.
        </Text>
      </View>
    );
  }

  return (
    <ConfiguredCustomerSessionApp
      dependencies={result.dependencies}
      {...(signedOutContent === undefined ? {} : { signedOutContent })}
    >
      {children}
    </ConfiguredCustomerSessionApp>
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
