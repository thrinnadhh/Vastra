import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  AuthSessionPort,
  RestorableSession,
  SessionRestorationState,
  SessionRestorer,
} from './session-restoration.types';

interface CaptainSessionRootProps {
  readonly authSession: AuthSessionPort;
  readonly sessionRestorer: SessionRestorer;
  readonly children: ReactNode;
}

const RESTORING_STATE: SessionRestorationState = Object.freeze({
  status: 'RESTORING',
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

export function CaptainSessionRoot({
  authSession,
  sessionRestorer,
  children,
}: CaptainSessionRootProps) {
  const [state, setState] = useState<SessionRestorationState>(RESTORING_STATE);
  const mounted = useRef(false);
  const operation = useRef(0);

  const applyResult = useCallback(
    async (
      task: () => Promise<SessionRestorationState>,
      showRestoringState: boolean,
    ): Promise<void> => {
      const operationId = ++operation.current;

      if (showRestoringState) {
        setState(RESTORING_STATE);
      }

      let nextState: SessionRestorationState;

      try {
        nextState = await task();
      } catch {
        nextState = { status: 'UNAVAILABLE' };
      }

      if (mounted.current && operation.current === operationId) {
        setState(nextState);
      }
    },
    [],
  );

  const restore = useCallback(
    () => applyResult(() => sessionRestorer.restore(), true),
    [applyResult, sessionRestorer],
  );

  const restoreSession = useCallback(
    (session: RestorableSession) =>
      applyResult(() => sessionRestorer.restoreSession(session), false),
    [applyResult, sessionRestorer],
  );

  useEffect(() => {
    mounted.current = true;

    const unsubscribe = authSession.onSessionChange((event, session) => {
      if (!mounted.current) {
        return;
      }

      if (event === 'SIGNED_OUT' || session === null) {
        operation.current += 1;
        setState({ status: 'SIGNED_OUT' });
        return;
      }

      void restoreSession(session);
    });

    const operationId = ++operation.current;

    void sessionRestorer.restore().then(
      (nextState) => {
        if (mounted.current && operation.current === operationId) {
          setState(nextState);
        }
      },
      () => {
        if (mounted.current && operation.current === operationId) {
          setState({ status: 'UNAVAILABLE' });
        }
      },
    );

    return () => {
      mounted.current = false;
      operation.current += 1;
      unsubscribe();
    };
  }, [authSession, restoreSession, sessionRestorer]);

  switch (state.status) {
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
        <StatusScreen
          title="Sign in to continue"
          description="Your saved session is not available. Phone OTP sign-in will be provided by the authentication flow."
        />
      );

    case 'ACCESS_DENIED':
      return (
        <StatusScreen
          title="This account cannot open the captain app"
          description="Use the Vastra app that matches this account, or contact support if this looks wrong."
        />
      );

    case 'UNAVAILABLE':
      return (
        <StatusScreen
          title="We could not restore your session"
          description="Check your connection and try again. Your saved sign-in has not been removed."
          actionLabel="Retry session restoration"
          onAction={() => {
            void restore();
          }}
        />
      );

    case 'AUTHENTICATED':
      return <>{children}</>;
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
