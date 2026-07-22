import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { RETURNING_CUSTOMER_LAUNCH_STORE, type CustomerLaunchStore } from './customer-launch-store';
import { CustomerSessionActionsProvider } from './customer-session-actions';
import {
  bootstrapCustomerSession,
  type CustomerBootstrapState,
} from './customer-session-bootstrap';
import type {
  AuthSessionPort,
  CurrentAccount,
  RestorableSession,
  SessionRestorationState,
  SessionRestorer,
} from './session-restoration.types';

interface CustomerSessionRootProps {
  readonly authSession: AuthSessionPort;
  readonly sessionRestorer: SessionRestorer;
  readonly launchStore?: CustomerLaunchStore;
  readonly signedOutContent?: ReactNode;
  readonly profileSetupContent?: (options: {
    readonly account: CurrentAccount & { readonly accountType: 'CUSTOMER' };
    readonly onCompleted: () => void;
  }) => ReactNode;
  readonly children: ReactNode;
}

const BOOTSTRAPPING_STATE: CustomerBootstrapState = Object.freeze({
  status: 'BOOTSTRAPPING',
});

function StatusScreen({
  title,
  description,
  actionLabel,
  onAction,
  busy = false,
}: {
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly busy?: boolean;
}) {
  return (
    <View style={styles.screen}>
      {busy ? (
        <ActivityIndicator accessibilityLabel="Restoring Vastra session" size="large" />
      ) : null}

      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>

      <Text style={styles.description}>{description}</Text>

      {actionLabel !== undefined && onAction !== undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CustomerSessionRoot({
  authSession,
  sessionRestorer,
  launchStore = RETURNING_CUSTOMER_LAUNCH_STORE,
  signedOutContent,
  profileSetupContent,
  children,
}: CustomerSessionRootProps) {
  const [state, setState] = useState<CustomerBootstrapState>(BOOTSTRAPPING_STATE);
  const mounted = useRef(false);
  const operation = useRef(0);

  const applySessionResult = useCallback(
    async (task: () => Promise<SessionRestorationState>): Promise<void> => {
      const operationId = ++operation.current;
      let session: SessionRestorationState;

      try {
        session = await task();
      } catch {
        session = { status: 'UNAVAILABLE' };
      }

      if (mounted.current && operation.current === operationId) {
        setState({ status: 'READY', session });
      }
    },
    [],
  );

  const runBootstrap = useCallback(async (): Promise<void> => {
    const operationId = ++operation.current;
    const nextState = await bootstrapCustomerSession(launchStore, sessionRestorer);

    if (mounted.current && operation.current === operationId) {
      setState(nextState);
    }
  }, [launchStore, sessionRestorer]);

  const retryBootstrap = useCallback((): void => {
    setState(BOOTSTRAPPING_STATE);
    void runBootstrap();
  }, [runBootstrap]);

  const completeProfileSetup = useCallback((): void => {
    setState(BOOTSTRAPPING_STATE);
    void runBootstrap();
  }, [runBootstrap]);

  const restoreSession = useCallback(
    (session: RestorableSession) =>
      applySessionResult(() => sessionRestorer.restoreSession(session)),
    [applySessionResult, sessionRestorer],
  );

  const completeWelcome = useCallback(async (): Promise<void> => {
    const operationId = ++operation.current;

    try {
      await launchStore.markWelcomeCompleted();
      if (mounted.current && operation.current === operationId) {
        setState({ status: 'READY', session: { status: 'SIGNED_OUT' } });
      }
    } catch {
      if (mounted.current && operation.current === operationId) {
        setState({ status: 'UNAVAILABLE' });
      }
    }
  }, [launchStore]);

  useEffect(() => {
    mounted.current = true;

    const unsubscribe = authSession.onSessionChange((event, session) => {
      if (!mounted.current) {
        return;
      }

      if (event === 'SIGNED_OUT' || session === null) {
        operation.current += 1;
        setState({ status: 'READY', session: { status: 'SIGNED_OUT' } });
        return;
      }

      void restoreSession(session);
    });

    void runBootstrap();

    return () => {
      mounted.current = false;
      operation.current += 1;
      unsubscribe();
    };
  }, [authSession, restoreSession, runBootstrap]);

  if (state.status === 'BOOTSTRAPPING') {
    return (
      <StatusScreen
        busy
        title="Opening Vastra"
        description="Restoring your secure sign-in and first-launch state."
      />
    );
  }

  if (state.status === 'WELCOME') {
    return (
      <StatusScreen
        title="Fashion from shops around you"
        description="Discover local fashion, track orders, and keep your style tools in one place."
        actionLabel="Continue to sign in"
        onAction={() => {
          void completeWelcome();
        }}
      />
    );
  }

  if (state.status === 'UNAVAILABLE') {
    return (
      <StatusScreen
        title="We could not open Vastra"
        description="Your saved sign-in has not been removed. Check your connection and try again."
        actionLabel="Retry opening Vastra"
        onAction={retryBootstrap}
      />
    );
  }

  switch (state.session.status) {
    case 'RESTORING':
      return (
        <StatusScreen
          busy
          title="Restoring your session"
          description="Checking your secure Vastra sign-in."
        />
      );

    case 'SIGNED_OUT':
      return (
        signedOutContent ?? (
          <StatusScreen
            title="Sign in to continue"
            description="Use your phone number and a secure one-time code to continue."
          />
        )
      );

    case 'ACCESS_DENIED':
      return (
        <StatusScreen
          title="This account cannot open the customer app"
          description="Use the Vastra app that matches this account, or contact support if this looks wrong."
        />
      );

    case 'UNAVAILABLE':
      return (
        <StatusScreen
          title="We could not restore your session"
          description="Check your connection and try again. Your saved sign-in has not been removed."
          actionLabel="Retry session restoration"
          onAction={retryBootstrap}
        />
      );

    case 'AUTHENTICATED':
      if (!state.session.account.profileCompleted) {
        return profileSetupContent === undefined ? (
          <StatusScreen
            title="Profile setup unavailable"
            description="Update Vastra and try again. Your account remains signed in securely."
          />
        ) : (
          profileSetupContent({
            account: state.session.account,
            onCompleted: completeProfileSetup,
          })
        );
      }

      return (
        <CustomerSessionActionsProvider account={state.session.account} authSession={authSession}>
          {children}
        </CustomerSessionActionsProvider>
      );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    backgroundColor: '#FFF8F2',
  },
  title: {
    marginTop: 20,
    color: '#241B16',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    maxWidth: 360,
    marginTop: 12,
    color: '#665A52',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  action: {
    marginTop: 28,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#8E3B46',
  },
  actionPressed: {
    opacity: 0.8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
