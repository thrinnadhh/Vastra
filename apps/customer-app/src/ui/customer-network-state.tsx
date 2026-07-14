import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  CustomerNetworkScreenState,
  CustomerStaleReason,
} from './customer-network-state.types';

interface CustomerNetworkStateBoundaryProps {
  readonly state: CustomerNetworkScreenState;
  readonly children: ReactNode;
  readonly onRetry: () => void;
  readonly onEmptyAction?: () => void;
}

interface StatePanelProps {
  readonly title: string;
  readonly message: string;
  readonly statusLabel: string;
  readonly actionLabel: string | null;
  readonly onAction: (() => void) | undefined;
  readonly tone: 'NEUTRAL' | 'ERROR' | 'OFFLINE';
}

interface StateActionProps {
  readonly label: string | null;
  readonly onPress: (() => void) | undefined;
}

function assertNever(value: never): never {
  throw new TypeError(`Unsupported customer network state: ${String(value)}`);
}

function StateAction({ label, onPress }: StateActionProps) {
  if (label === null || onPress === undefined) {
    return null;
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.action}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function StatePanel({ title, message, statusLabel, actionLabel, onAction, tone }: StatePanelProps) {
  const statusStyle =
    tone === 'ERROR'
      ? styles.errorStatus
      : tone === 'OFFLINE'
        ? styles.offlineStatus
        : styles.neutralStatus;

  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${message}`}
      accessibilityLiveRegion="polite"
      style={styles.stateScreen}
    >
      <View style={[styles.statusPill, statusStyle]}>
        <Text style={styles.statusText}>{statusLabel}</Text>
      </View>

      <Text accessibilityRole="header" style={styles.stateTitle}>
        {title}
      </Text>

      <Text style={styles.stateMessage}>{message}</Text>

      <StateAction label={actionLabel} onPress={onAction} />
    </View>
  );
}

export function CustomerLoadingSkeleton({ label }: { readonly label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={styles.loadingScreen}
    >
      <ActivityIndicator color="#6C3AA8" size="large" />

      <View style={styles.skeletonGroup}>
        <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
        <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
        <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
      </View>
    </View>
  );
}

export function CustomerEmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  readonly title: string;
  readonly message: string;
  readonly actionLabel: string | null;
  readonly onAction?: () => void;
}) {
  return (
    <StatePanel
      actionLabel={actionLabel}
      message={message}
      onAction={onAction}
      statusLabel="EMPTY"
      title={title}
      tone="NEUTRAL"
    />
  );
}

export function CustomerErrorState({
  title,
  message,
  retryLabel,
  onRetry,
}: {
  readonly title: string;
  readonly message: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}) {
  return (
    <StatePanel
      actionLabel={retryLabel}
      message={message}
      onAction={onRetry}
      statusLabel="ERROR"
      title={title}
      tone="ERROR"
    />
  );
}

export function CustomerOfflineState({
  title,
  message,
  retryLabel,
  onRetry,
}: {
  readonly title: string;
  readonly message: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}) {
  return (
    <StatePanel
      actionLabel={retryLabel}
      message={message}
      onAction={onRetry}
      statusLabel="OFFLINE"
      title={title}
      tone="OFFLINE"
    />
  );
}

export function CustomerStaleDataBanner({ reason }: { readonly reason: CustomerStaleReason }) {
  const message =
    reason === 'OFFLINE'
      ? 'Offline. Showing saved information.'
      : 'Refresh failed. Showing the last available information.';

  return (
    <View
      accessible
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
      style={styles.staleBanner}
    >
      <Text style={styles.staleLabel}>STALE DATA</Text>
      <Text style={styles.staleMessage}>{message}</Text>
    </View>
  );
}

export function CustomerNetworkStateBoundary({
  state,
  children,
  onRetry,
  onEmptyAction,
}: CustomerNetworkStateBoundaryProps) {
  switch (state.kind) {
    case 'LOADING':
      return <CustomerLoadingSkeleton label={state.accessibilityLabel} />;

    case 'EMPTY':
      return (
        <CustomerEmptyState
          actionLabel={state.actionLabel}
          message={state.message}
          onAction={onEmptyAction ?? onRetry}
          title={state.title}
        />
      );

    case 'ERROR':
      return (
        <CustomerErrorState
          message={state.message}
          onRetry={onRetry}
          retryLabel={state.retryLabel}
          title={state.title}
        />
      );

    case 'OFFLINE':
      return (
        <CustomerOfflineState
          message={state.message}
          onRetry={onRetry}
          retryLabel={state.retryLabel}
          title={state.title}
        />
      );

    case 'SUCCESS':
      return (
        <View style={styles.successScreen}>
          {state.staleReason === null ? null : (
            <CustomerStaleDataBanner reason={state.staleReason} />
          )}
          <View style={styles.successContent}>{children}</View>
        </View>
      );

    default:
      return assertNever(state);
  }
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  skeletonGroup: {
    width: '100%',
    maxWidth: 360,
    marginTop: 28,
  },
  skeletonLine: {
    height: 16,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#E4E7EC',
  },
  skeletonLineWide: {
    width: '100%',
  },
  skeletonLineMedium: {
    width: '76%',
  },
  skeletonLineShort: {
    width: '48%',
  },
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
  },
  statusPill: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  neutralStatus: {
    backgroundColor: '#F2ECF8',
  },
  errorStatus: {
    backgroundColor: '#FCE8E8',
  },
  offlineStatus: {
    backgroundColor: '#FFF3D8',
  },
  statusText: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  stateTitle: {
    marginTop: 20,
    color: '#1F2937',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateMessage: {
    maxWidth: 360,
    marginTop: 10,
    color: '#667085',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  action: {
    minWidth: 140,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#6C3AA8',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  successScreen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  successContent: {
    flex: 1,
  },
  staleBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E7EC',
    backgroundColor: '#FFF3D8',
  },
  staleLabel: {
    color: '#7A4B00',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  staleMessage: {
    marginTop: 3,
    color: '#5F430D',
    fontSize: 14,
    lineHeight: 20,
  },
});
