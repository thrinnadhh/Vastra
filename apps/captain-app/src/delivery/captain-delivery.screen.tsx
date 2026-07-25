import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import type {
  CaptainLocationProvider,
  CaptainPresencePort,
} from '../presence/captain-presence.types';
import { CaptainActiveDeliveryCard } from './captain-active-delivery.card';
import { CaptainDeliveryApiError } from './captain-delivery.client';
import { CaptainDeliveryOfferCard } from './captain-delivery.offer-card';
import type {
  CaptainDelivery,
  CaptainDeliveryPort,
  DeliveryLocation,
  DeliveryRejectionReason,
} from './captain-delivery.types';
import { styles, type IssueSelection } from './captain-delivery.view';

interface CaptainDeliveryScreenProps {
  readonly client: CaptainDeliveryPort;
  readonly presenceClient: CaptainPresencePort;
  readonly locationProvider: CaptainLocationProvider;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0').slice(-12)}`;
}

function lifecycleLocation(
  sample: Awaited<ReturnType<CaptainLocationProvider['getCurrentLocation']>>,
): DeliveryLocation {
  return {
    latitude: sample.latitude,
    longitude: sample.longitude,
    accuracyMeters: sample.accuracyMeters,
    recordedAt: sample.recordedAt,
  };
}

function messageFor(error: unknown): string {
  if (error instanceof CaptainDeliveryApiError) {
    const messages: Readonly<Record<string, string>> = {
      AUTHENTICATION_REQUIRED: 'Your session ended. Sign in again.',
      AUTHENTICATION_INVALID: 'Your session is no longer valid. Sign in again.',
      SESSION_EXPIRED: 'Your session expired. Sign in again.',
      DELIVERY_OFFER_EXPIRED: 'That offer expired. Nearby offers are being refreshed.',
      DELIVERY_TASK_ALREADY_ASSIGNED: 'Another captain accepted that delivery first.',
      CAPTAIN_NOT_AT_PICKUP: 'Move closer to the shop before confirming arrival.',
      PICKUP_CODE_INVALID: 'The pickup code is incorrect. Confirm it with the merchant.',
      DELIVERY_OTP_INVALID: 'The delivery OTP is incorrect. Confirm it with the customer.',
      DELIVERY_SECRET_LOCKED:
        'Too many incorrect code attempts. Operations must review this delivery.',
      COD_AMOUNT_MISMATCH:
        'The server rejected the cash amount. Refresh the delivery before trying again.',
      DELIVERY_STATE_CONFLICT:
        'The delivery changed on the server. Vastra is refreshing the authoritative state.',
    };
    return messages[error.code] ?? error.message;
  }

  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return 'Delivery information is temporarily unavailable. Check your network and retry.';
}

export function CaptainDeliveryScreen({
  client,
  presenceClient,
  locationProvider,
}: CaptainDeliveryScreenProps): React.JSX.Element {
  const [active, setActive] = useState<CaptainDelivery | null>(null);
  const [offers, setOffers] = useState<readonly CaptainDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pickupCode, setPickupCode] = useState('');
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [cashConfirmed, setCashConfirmed] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueSelection, setIssueSelection] = useState<IssueSelection | null>(null);
  const [issueNote, setIssueNote] = useState('');
  const mounted = useRef(true);
  const hasLoadedRef = useRef(false);

  const load = useCallback(
    async (preserveNotice = false): Promise<void> => {
      if (!hasLoadedRef.current) setLoading(true);

      try {
        const current = await client.getActive();
        if (!mounted.current) return;

        const nextOffers = current === null ? await client.listOffers() : [];
        if (!mounted.current) return;

        setActive(current);
        setOffers(nextOffers);
        hasLoadedRef.current = true;
        setHasLoaded(true);
        if (!preserveNotice) setNotice(null);
      } catch (error: unknown) {
        if (mounted.current) setNotice(messageFor(error));
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    mounted.current = true;
    const initialLoad = setTimeout(() => {
      void load();
    }, 0);
    const refresh = setInterval(() => {
      void load();
    }, 10_000);
    const clock = setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => {
      mounted.current = false;
      clearTimeout(initialLoad);
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, [load]);

  useEffect(() => {
    setPickupCode('');
    setDeliveryOtp('');
    setCashConfirmed(false);
    setIssueOpen(false);
    setIssueSelection(null);
    setIssueNote('');
  }, [active?.taskId, active?.taskStatus]);

  useEffect(() => {
    if (
      active === null ||
      !['ASSIGNED', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROP'].includes(active.taskStatus)
    ) {
      return undefined;
    }

    let stopped = false;
    let stopWatching: (() => void) | undefined;

    void locationProvider
      .requestForegroundPermission()
      .then(async (permission) => {
        if (!permission.granted || stopped) return;
        stopWatching = await locationProvider.watchLocations((sample) => {
          void presenceClient
            .updateLocation({ ...sample, activeDeliveryTaskId: active.taskId })
            .catch(() => undefined);
        });
        if (stopped) stopWatching();
      })
      .catch(() => {
        if (!stopped && mounted.current) {
          setNotice('Live location paused. Check location permission and network access.');
        }
      });

    return () => {
      stopped = true;
      stopWatching?.();
    };
  }, [active, locationProvider, presenceClient]);

  const visibleOffers = useMemo(
    () => offers.filter((offer) => Date.parse(offer.expiresAt) > now),
    [now, offers],
  );

  const currentLocation = useCallback(
    async (required: boolean): Promise<DeliveryLocation | null> => {
      const permission = await locationProvider.requestForegroundPermission();
      if (!permission.granted) {
        if (required) {
          throw new Error(
            permission.canAskAgain
              ? 'Location permission is required for this step.'
              : 'Enable location permission in Android settings before continuing.',
          );
        }
        return null;
      }
      return lifecycleLocation(await locationProvider.getCurrentLocation());
    },
    [locationProvider],
  );

  const run = useCallback(
    async (operation: () => Promise<CaptainDelivery | null>, success?: string): Promise<void> => {
      setBusy(true);
      setNotice(null);
      try {
        const result = await operation();
        if (!mounted.current) return;
        setActive(result);
        setOffers([]);
        setNotice(success ?? null);
      } catch (error: unknown) {
        if (mounted.current) {
          setNotice(messageFor(error));
          if (error instanceof CaptainDeliveryApiError && !error.retryable) {
            await load(true);
          }
        }
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [load],
  );

  const openUrl = useCallback(async (url: string): Promise<void> => {
    try {
      await Linking.openURL(url);
    } catch {
      if (mounted.current) setNotice('Could not open that app. Try again when safely stopped.');
    }
  }, []);

  const accept = (offer: CaptainDelivery): void => {
    void run(
      () => client.acceptOffer(offer.assignmentId, createIdempotencyKey()),
      'Delivery assigned. Review the pickup details before travelling.',
    );
  };

  const reject = async (offer: CaptainDelivery, reason: DeliveryRejectionReason): Promise<void> => {
    setBusy(true);
    setNotice(null);
    try {
      await client.rejectOffer(offer.assignmentId, reason, createIdempotencyKey());
      await load();
    } catch (error: unknown) {
      if (mounted.current) {
        setNotice(messageFor(error));
        if (error instanceof CaptainDeliveryApiError && !error.retryable) {
          await load(true);
        }
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const submitIssue = (): void => {
    if (active === null || issueSelection === null) return;
    if (issueSelection.reason === 'OTHER' && issueNote.trim().length === 0) {
      setNotice('Add a short note when selecting Other reason.');
      return;
    }

    void run(
      async () => {
        const location = await currentLocation(false);
        if (issueSelection.kind === 'RELEASE') {
          await client.release(
            active.taskId,
            issueSelection.reason,
            issueNote.trim() || null,
            location,
            createIdempotencyKey(),
          );
          return null;
        }

        await client.reportProblem(
          active.taskId,
          issueSelection.reason,
          issueNote.trim() || null,
          location,
          createIdempotencyKey(),
        );
        return null;
      },
      issueSelection.kind === 'RELEASE'
        ? 'Delivery released to operations before pickup.'
        : 'Problem escalated to operations. Package custody remains recorded.',
    );
  };

  if (loading && !hasLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading captain deliveries" size="large" />
        <Text style={styles.meta}>Loading delivery work…</Text>
      </View>
    );
  }

  if (!hasLoaded && notice !== null) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          Delivery work unavailable
        </Text>
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void load();
          }}
          style={styles.primaryButtonFull}
        >
          <Text style={styles.primaryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>CAPTAIN DELIVERY</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {active === null ? 'Nearby delivery offers' : 'Active delivery'}
      </Text>

      {notice === null ? null : (
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      )}

      {active === null ? (
        visibleOffers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No active offers</Text>
            <Text style={styles.meta}>
              Stay online with a fresh location. Expired offers are removed automatically.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void load();
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>Refresh offers</Text>
            </Pressable>
          </View>
        ) : (
          visibleOffers.map((offer) => (
            <CaptainDeliveryOfferCard
              busy={busy}
              key={offer.assignmentId}
              now={now}
              offer={offer}
              onAccept={() => {
                accept(offer);
              }}
              onReject={(reason) => {
                void reject(offer, reason);
              }}
            />
          ))
        )
      ) : (
        <CaptainActiveDeliveryCard
          active={active}
          busy={busy}
          cashConfirmed={cashConfirmed}
          deliveryOtp={deliveryOtp}
          issueNote={issueNote}
          issueOpen={issueOpen}
          issueSelection={issueSelection}
          onArriveDrop={() => {
            void run(
              async () =>
                client.arriveDrop(
                  active.taskId,
                  await currentLocation(false),
                  createIdempotencyKey(),
                ),
              'Customer arrival confirmed.',
            );
          }}
          onArrivePickup={() => {
            void run(async () => {
              const location = await currentLocation(true);
              if (location === null) throw new Error('Location is required to confirm arrival.');
              return client.arrivePickup(active.taskId, location, createIdempotencyKey());
            });
          }}
          onCall={() => {
            const phone =
              active.taskStatus === 'IN_TRANSIT' || active.taskStatus === 'AT_DROP'
                ? active.drop.phoneNumber
                : active.pickup.phoneNumber;
            if (phone !== null) void openUrl(`tel:${phone}`);
          }}
          onCashConfirmationChange={() => {
            setCashConfirmed((value) => !value);
          }}
          onComplete={() => {
            void run(async () => {
              await client.complete(
                active.taskId,
                active.totalPaise,
                deliveryOtp,
                await currentLocation(false),
                createIdempotencyKey(),
              );
              setDeliveryOtp('');
              setCashConfirmed(false);
              return null;
            }, 'Delivery completed and COD collection recorded.');
          }}
          onDeliveryOtpChange={setDeliveryOtp}
          onDepartPickup={() => {
            void run(
              async () =>
                client.departPickup(
                  active.taskId,
                  await currentLocation(false),
                  createIdempotencyKey(),
                ),
              'Customer delivery started.',
            );
          }}
          onIssueClose={() => {
            setIssueOpen(false);
            setIssueSelection(null);
            setIssueNote('');
          }}
          onIssueNoteChange={setIssueNote}
          onIssueOpen={() => {
            setIssueOpen(true);
          }}
          onIssueSelectionChange={setIssueSelection}
          onNavigate={() => {
            const target =
              active.taskStatus === 'IN_TRANSIT' || active.taskStatus === 'AT_DROP'
                ? active.drop.location
                : active.pickup.location;
            void openUrl(
              'https://www.google.com/maps/dir/?api=1&destination=' +
                `${String(target.latitude)},${String(target.longitude)}`,
            );
          }}
          onPickupCodeChange={setPickupCode}
          onSubmitIssue={submitIssue}
          onVerifyPickup={() => {
            void run(async () => {
              const result = await client.verifyPickup(
                active.taskId,
                pickupCode,
                createIdempotencyKey(),
              );
              setPickupCode('');
              return result;
            }, 'Package handover verified by the server.');
          }}
          pickupCode={pickupCode}
        />
      )}
    </ScrollView>
  );
}
