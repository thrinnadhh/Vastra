import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCaptainApiSession } from '../auth/captain-api-session';
import { CaptainPresenceApiError, HttpCaptainPresenceClient } from './captain-presence.client';
import { ExpoCaptainLocationProvider } from './expo-captain-location.provider';
import type {
  CaptainAvailabilityStatus,
  CaptainLocationProvider,
  CaptainLocationSample,
  CaptainPresencePort,
  CaptainRequestedAvailabilityStatus,
} from './captain-presence.types';

interface CaptainPresenceScreenProps {
  readonly client: CaptainPresencePort;
  readonly locationProvider: CaptainLocationProvider;
}

type ScreenState =
  | { readonly kind: 'LOADING' }
  | {
      readonly kind: 'READY';
      readonly status: CaptainAvailabilityStatus;
      readonly dispatchEligible: boolean;
      readonly locationRecordedAt: string | null;
    }
  | { readonly kind: 'ERROR'; readonly message: string };

function describeError(error: unknown): string {
  if (error instanceof CaptainPresenceApiError) {
    switch (error.code) {
      case 'CAPTAIN_LOCATION_STALE':
        return 'Your location is stale or inaccurate. Move to an open area and try again.';
      case 'CAPTAIN_NOT_ELIGIBLE':
        return 'Your captain account, notification setup, or approval is not ready.';
      case 'DELIVERY_STATE_CONFLICT':
        return 'An active delivery currently controls your availability.';
      case 'LOCATION_UPDATE_RATE_LIMITED':
        return 'Location was sent too recently. Vastra will retry automatically.';
      default:
        return error.message;
    }
  }

  return 'We could not update captain availability. Check your connection and try again.';
}

function isClientControlled(status: CaptainAvailabilityStatus): boolean {
  return status === 'OFFLINE' || status === 'AVAILABLE' || status === 'ON_BREAK';
}

export function CaptainPresenceScreen({ client, locationProvider }: CaptainPresenceScreenProps) {
  const [state, setState] = useState<ScreenState>({ kind: 'LOADING' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(false);
  const sendChain = useRef<Promise<void>>(Promise.resolve());

  const load = useCallback(async (): Promise<void> => {
    setState({ kind: 'LOADING' });
    setNotice(null);

    try {
      const status = await client.getAvailability();
      if (mounted.current) {
        setState({
          kind: 'READY',
          status,
          dispatchEligible: false,
          locationRecordedAt: null,
        });
      }
    } catch (error: unknown) {
      if (mounted.current) {
        setState({ kind: 'ERROR', message: describeError(error) });
      }
    }
  }, [client]);

  useEffect(() => {
    mounted.current = true;
    void load();

    return () => {
      mounted.current = false;
    };
  }, [load]);

  const sendLocation = useCallback(
    (sample: CaptainLocationSample): void => {
      sendChain.current = sendChain.current.then(async () => {
        try {
          const result = await client.updateLocation(sample);
          if (mounted.current) {
            setState((current) =>
              current.kind === 'READY'
                ? {
                    ...current,
                    locationRecordedAt: result.acceptedAt,
                  }
                : current,
            );
          }
        } catch (error: unknown) {
          if (
            mounted.current &&
            !(
              error instanceof CaptainPresenceApiError &&
              error.code === 'LOCATION_UPDATE_RATE_LIMITED'
            )
          ) {
            setNotice(describeError(error));
          }
        }
      });
    },
    [client],
  );

  const currentAvailabilityStatus = state.kind === 'READY' ? state.status : null;

  useEffect(() => {
    if (currentAvailabilityStatus !== 'AVAILABLE') {
      return undefined;
    }

    let active = true;
    let stopWatching: (() => void) | undefined;

    void locationProvider
      .watchLocations((sample) => {
        if (active) sendLocation(sample);
      })
      .then(
        (stop) => {
          if (active) {
            stopWatching = stop;
          } else {
            stop();
          }
        },
        (error: unknown) => {
          if (active && mounted.current) setNotice(describeError(error));
        },
      );

    return () => {
      active = false;
      stopWatching?.();
    };
  }, [currentAvailabilityStatus, locationProvider, sendLocation]);

  const requestStatus = useCallback(
    async (status: CaptainRequestedAvailabilityStatus): Promise<void> => {
      setBusy(true);
      setNotice(null);

      try {
        if (status === 'AVAILABLE') {
          const permission = await locationProvider.requestForegroundPermission();
          if (!permission.granted) {
            setNotice(
              permission.canAskAgain
                ? 'Location permission is required to receive nearby delivery offers.'
                : 'Enable location permission in Android settings to go online.',
            );
            return;
          }

          await client.updateLocation(await locationProvider.getCurrentLocation());
        }

        const result = await client.setAvailability(status);
        if (mounted.current) {
          setState({
            kind: 'READY',
            status: result.availabilityStatus,
            dispatchEligible: result.dispatchEligible,
            locationRecordedAt: result.locationRecordedAt,
          });
        }
      } catch (error: unknown) {
        if (mounted.current) setNotice(describeError(error));
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [client, locationProvider],
  );

  if (state.kind === 'LOADING') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel="Loading captain availability" size="large" />
        <Text style={styles.loadingText}>Checking your captain status…</Text>
      </View>
    );
  }

  if (state.kind === 'ERROR') {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="header" style={styles.errorTitle}>
          Captain status unavailable
        </Text>
        <Text style={styles.errorText}>{state.message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry captain status"
          onPress={() => {
            void load();
          }}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const operationallyControlled = !isClientControlled(state.status);

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>CAPTAIN OPERATIONS</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Delivery availability
      </Text>
      <Text style={styles.description}>
        Vastra uses your foreground location while you are online to find nearby pickup work.
      </Text>

      <View
        accessible
        accessibilityLabel={`Captain availability ${state.status}`}
        style={styles.statusCard}
      >
        <View style={[styles.statusDot, state.status === 'AVAILABLE' ? styles.onlineDot : null]} />
        <View style={styles.statusCopy}>
          <Text style={styles.statusLabel}>{state.status.replaceAll('_', ' ')}</Text>
          <Text style={styles.statusDescription}>
            {state.dispatchEligible
              ? 'Ready for nearby delivery offers.'
              : operationallyControlled
                ? 'This status is controlled by your current delivery.'
                : 'You are not receiving new delivery offers.'}
          </Text>
          {state.locationRecordedAt !== null ? (
            <Text style={styles.locationTime}>
              Location confirmed {new Date(state.locationRecordedAt).toLocaleTimeString()}
            </Text>
          ) : null}
        </View>
      </View>

      {notice !== null ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {state.status !== 'AVAILABLE' && !operationallyControlled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go online for deliveries"
            disabled={busy}
            onPress={() => {
              void requestStatus('AVAILABLE');
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed ? styles.pressed : null,
              busy ? styles.disabled : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>{busy ? 'Updating…' : 'Go online'}</Text>
          </Pressable>
        ) : null}

        {state.status === 'AVAILABLE' ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take a delivery break"
              disabled={busy}
              onPress={() => {
                void requestStatus('ON_BREAK');
              }}
              style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.secondaryButtonText}>Take break</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go offline from deliveries"
              disabled={busy}
              onPress={() => {
                void requestStatus('OFFLINE');
              }}
              style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.secondaryButtonText}>Go offline</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

export function AuthenticatedCaptainPresenceScreen() {
  const session = useCaptainApiSession();
  const client = useMemo(
    () => new HttpCaptainPresenceClient(session.apiBaseUrl, () => session.getAccessToken()),
    [session],
  );
  const locationProvider = useMemo(() => new ExpoCaptainLocationProvider(), []);

  return <CaptainPresenceScreen client={client} locationProvider={locationProvider} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#FFF8F2',
  },
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    backgroundColor: '#FFF8F2',
  },
  loadingText: {
    marginTop: 16,
    color: '#665A52',
    fontSize: 16,
  },
  eyebrow: {
    color: '#8E3B46',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 8,
    color: '#241B16',
    fontSize: 34,
    fontWeight: '700',
  },
  description: {
    marginTop: 12,
    color: '#665A52',
    fontSize: 16,
    lineHeight: 24,
  },
  statusCard: {
    flexDirection: 'row',
    marginTop: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8DDD5',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  statusDot: {
    width: 12,
    height: 12,
    marginTop: 5,
    marginRight: 14,
    borderRadius: 6,
    backgroundColor: '#9C8E84',
  },
  onlineDot: {
    backgroundColor: '#287A55',
  },
  statusCopy: {
    flex: 1,
  },
  statusLabel: {
    color: '#241B16',
    fontSize: 20,
    fontWeight: '700',
  },
  statusDescription: {
    marginTop: 5,
    color: '#665A52',
    fontSize: 14,
    lineHeight: 20,
  },
  locationTime: {
    marginTop: 10,
    color: '#287A55',
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  primaryButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 15,
    borderRadius: 15,
    backgroundColor: '#8E3B46',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#8E3B46',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#8E3B46',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.55,
  },
  notice: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    color: '#7A2F38',
    backgroundColor: '#FCECEE',
    fontSize: 14,
    lineHeight: 20,
  },
  errorTitle: {
    color: '#241B16',
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 12,
    color: '#665A52',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
