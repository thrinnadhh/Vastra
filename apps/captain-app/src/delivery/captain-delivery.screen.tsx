import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useCaptainApiSession } from '../auth/captain-api-session';
import { HttpCaptainPresenceClient } from '../presence/captain-presence.client';
import { ExpoCaptainLocationProvider } from '../presence/expo-captain-location.provider';
import type {
  CaptainLocationProvider,
  CaptainPresencePort,
} from '../presence/captain-presence.types';
import { CaptainDeliveryApiError, HttpCaptainDeliveryClient } from './captain-delivery.client';
import type {
  CaptainDelivery,
  CaptainDeliveryPort,
  DeliveryLocation,
  DeliveryProblemReason,
  DeliveryRejectionReason,
  DeliveryReleaseReason,
} from './captain-delivery.types';

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  return `00000000-0000-4000-8000-${Date.now().toString().padStart(12, '0').slice(-12)}`;
}

function messageFor(error: unknown): string {
  if (error instanceof CaptainDeliveryApiError) {
    const messages: Record<string, string> = {
      DELIVERY_OFFER_EXPIRED: 'That offer expired. Vastra is refreshing your offers.',
      DELIVERY_TASK_ALREADY_ASSIGNED: 'Another captain accepted this delivery first.',
      CAPTAIN_NOT_AT_PICKUP: 'Move closer to the shop before marking arrival.',
      PICKUP_CODE_INVALID: 'The pickup code is incorrect. Confirm it with the merchant.',
      DELIVERY_OTP_INVALID: 'The delivery OTP is incorrect. Confirm it with the customer.',
      DELIVERY_SECRET_LOCKED:
        'Too many failed code attempts. Operations support must review this delivery.',
      COD_AMOUNT_MISMATCH: 'Collect the exact order total shown in the app.',
    };
    return messages[error.code] ?? error.message;
  }
  return 'Delivery information is temporarily unavailable. Check your connection and retry.';
}

function money(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}
function distance(meters: number | null): string {
  if (meters === null) return 'Distance pending';
  return meters < 1000
    ? `${String(Math.round(meters))} m away`
    : `${(meters / 1000).toFixed(1)} km away`;
}
function addressLine(delivery: CaptainDelivery, target: 'pickup' | 'drop'): string {
  const address = delivery[target];
  return `${address.line1}${address.line2 === null ? '' : `, ${address.line2}`}, ${address.area}, ${address.city}`;
}
function asLifecycleLocation(
  sample: Awaited<ReturnType<CaptainLocationProvider['getCurrentLocation']>>,
): DeliveryLocation {
  return {
    latitude: sample.latitude,
    longitude: sample.longitude,
    accuracyMeters: sample.accuracyMeters,
    recordedAt: sample.recordedAt,
  };
}
function paiseFromInput(value: string): number | null {
  if (!/^\d+(?:\.\d{0,2})?$/u.test(value.trim())) return null;
  const parsed = Math.round(Number(value) * 100);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function OfferCard({
  offer,
  busy,
  now,
  onAccept,
  onReject,
}: {
  readonly offer: CaptainDelivery;
  readonly busy: boolean;
  readonly now: number;
  readonly onAccept: () => void;
  readonly onReject: (reason: DeliveryRejectionReason) => void;
}) {
  const remaining = Math.max(0, Math.ceil((Date.parse(offer.expiresAt) - now) / 1000));
  return (
    <View accessible accessibilityLabel={`Delivery offer ${offer.orderNumber}`} style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{offer.pickup.recipientName ?? 'Pickup shop'}</Text>
        <Text
          accessibilityLabel={`Offer expires in ${String(remaining)} seconds`}
          style={styles.timer}
        >
          {remaining}s
        </Text>
      </View>
      <Text style={styles.meta}>
        {distance(offer.pickupDistanceMeters)} · Order {offer.orderNumber}
      </Text>
      <Text style={styles.address}>{addressLine(offer, 'pickup')}</Text>
      <View style={styles.rowBetween}>
        <Text style={styles.earning}>Earn {money(offer.offeredEarningPaise)}</Text>
        <Text style={styles.cod}>COD {money(offer.totalPaise)}</Text>
      </View>
      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          disabled={busy || remaining === 0}
          onPress={() => {
            onReject('TOO_FAR');
          }}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryText}>Reject</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy || remaining === 0}
          onPress={onAccept}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryText}>{busy ? 'Working…' : 'Accept'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface CaptainDeliveryScreenProps {
  readonly client: CaptainDeliveryPort;
  readonly presenceClient: CaptainPresencePort;
  readonly locationProvider: CaptainLocationProvider;
}

export function CaptainDeliveryScreen({
  client,
  presenceClient,
  locationProvider,
}: CaptainDeliveryScreenProps) {
  const [active, setActive] = useState<CaptainDelivery | null>(null);
  const [offers, setOffers] = useState<readonly CaptainDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pickupCode, setPickupCode] = useState('');
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [problemNote, setProblemNote] = useState('');
  const mounted = useRef(true);

  const load = useCallback(async (): Promise<void> => {
    try {
      const current = await client.getActive();
      if (!mounted.current) return;
      setActive(current);
      setOffers(current === null ? await client.listOffers() : []);
      if (current !== null && codAmount.length === 0)
        setCodAmount((current.totalPaise / 100).toFixed(2));
      setNotice(null);
    } catch (error: unknown) {
      if (mounted.current) setNotice(messageFor(error));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [client, codAmount.length]);

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
    if (
      active === null ||
      !['ASSIGNED', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROP'].includes(active.taskStatus)
    )
      return undefined;
    const subscription = locationProvider.requestForegroundPermission().then(async (permission) => {
      if (!permission.granted) return undefined;
      return locationProvider.watchLocations((sample) => {
        void presenceClient
          .updateLocation({ ...sample, activeDeliveryTaskId: active.taskId })
          .catch(() => undefined);
      });
    });
    return () => {
      void subscription
        .then((stopWatching) => {
          stopWatching?.();
        })
        .catch(() => undefined);
    };
  }, [active, locationProvider, presenceClient]);

  const location = useCallback(
    async (required: boolean): Promise<DeliveryLocation | null> => {
      const permission = await locationProvider.requestForegroundPermission();
      if (!permission.granted) {
        if (required) throw new Error('Location permission is required for this step.');
        return null;
      }
      return asLifecycleLocation(await locationProvider.getCurrentLocation());
    },
    [locationProvider],
  );

  const run = useCallback(
    async (operation: () => Promise<CaptainDelivery | null>, success?: string): Promise<void> => {
      setBusy(true);
      try {
        const result = await operation();
        setActive(result);
        setOffers([]);
        setNotice(success ?? null);
      } catch (error: unknown) {
        setNotice(
          error instanceof Error && !(error instanceof CaptainDeliveryApiError)
            ? error.message
            : messageFor(error),
        );
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const accept = (offer: CaptainDelivery) =>
    run(() => client.acceptOffer(offer.assignmentId, createIdempotencyKey()));
  const reject = async (offer: CaptainDelivery, reason: DeliveryRejectionReason): Promise<void> => {
    setBusy(true);
    try {
      await client.rejectOffer(offer.assignmentId, reason, createIdempotencyKey());
      await load();
    } catch (error: unknown) {
      setNotice(messageFor(error));
    } finally {
      setBusy(false);
    }
  };

  const arrivePickup = () =>
    active === null
      ? undefined
      : run(async () => {
          const currentLocation = await location(true);
          if (currentLocation === null) {
            throw new Error('Location is required to confirm store arrival.');
          }
          return client.arrivePickup(active.taskId, currentLocation, createIdempotencyKey());
        });
  const verifyPickup = () =>
    active === null
      ? undefined
      : run(async () => {
          const result = await client.verifyPickup(
            active.taskId,
            pickupCode,
            createIdempotencyKey(),
          );
          setPickupCode('');
          return result;
        }, 'Package handover verified.');
  const departPickup = () =>
    active === null
      ? undefined
      : run(async () =>
          client.departPickup(active.taskId, await location(false), createIdempotencyKey()),
        );
  const arriveDrop = () =>
    active === null
      ? undefined
      : run(async () =>
          client.arriveDrop(active.taskId, await location(false), createIdempotencyKey()),
        );
  const complete = () =>
    active === null
      ? undefined
      : run(async () => {
          const amount = paiseFromInput(codAmount);
          if (amount === null) throw new Error('Enter a valid COD amount.');
          await client.complete(
            active.taskId,
            amount,
            deliveryOtp,
            await location(false),
            createIdempotencyKey(),
          );
          setDeliveryOtp('');
          setCodAmount('');
          return null;
        }, 'Delivery completed successfully.');
  const release = (reason: DeliveryReleaseReason) =>
    active === null
      ? undefined
      : run(async () => {
          await client.release(
            active.taskId,
            reason,
            problemNote.trim() || null,
            await location(false),
            createIdempotencyKey(),
          );
          return null;
        }, 'Delivery released for reassignment.');
  const reportProblem = (reason: DeliveryProblemReason) =>
    active === null
      ? undefined
      : run(async () => {
          await client.reportProblem(
            active.taskId,
            reason,
            problemNote.trim() || null,
            await location(false),
            createIdempotencyKey(),
          );
          return null;
        }, 'Problem reported to operations.');

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading deliveries" />
        <Text>Loading delivery work…</Text>
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>CAPTAIN DELIVERY</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {active === null ? 'Nearby delivery offers' : 'Active delivery'}
      </Text>
      {notice === null ? null : (
        <Text accessibilityRole="alert" style={styles.notice}>
          {notice}
        </Text>
      )}
      {active === null ? (
        offers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No active offers</Text>
            <Text style={styles.meta}>
              Stay available with a fresh location. Nearby work will appear automatically.
            </Text>
            <Pressable
              onPress={() => {
                void load();
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>Refresh</Text>
            </Pressable>
          </View>
        ) : (
          offers.map((offer) => (
            <OfferCard
              key={offer.assignmentId}
              offer={offer}
              busy={busy}
              now={now}
              onAccept={() => {
                void accept(offer);
              }}
              onReject={(reason) => {
                void reject(offer, reason);
              }}
            />
          ))
        )
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {active.taskStatus === 'IN_TRANSIT' || active.taskStatus === 'AT_DROP'
              ? (active.drop.recipientName ?? 'Customer')
              : (active.pickup.recipientName ?? 'Pickup shop')}
          </Text>
          <Text style={styles.meta}>
            Order {active.orderNumber} · {active.taskStatus.replaceAll('_', ' ')}
          </Text>
          <Text style={styles.address}>
            {addressLine(
              active,
              active.taskStatus === 'IN_TRANSIT' || active.taskStatus === 'AT_DROP'
                ? 'drop'
                : 'pickup',
            )}
          </Text>
          <View style={styles.actionsRow}>
            <Pressable
              onPress={() =>
                void Linking.openURL(
                  `tel:${(active.taskStatus === 'IN_TRANSIT' || active.taskStatus === 'AT_DROP' ? active.drop.phoneNumber : active.pickup.phoneNumber) ?? ''}`,
                )
              }
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>Call</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const target =
                  active.taskStatus === 'IN_TRANSIT' || active.taskStatus === 'AT_DROP'
                    ? active.drop.location
                    : active.pickup.location;
                void Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${String(target.latitude)},${String(target.longitude)}`,
                );
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>Navigate</Text>
            </Pressable>
          </View>

          {active.taskStatus === 'ASSIGNED' ? (
            <Pressable
              disabled={busy}
              onPress={() => void arrivePickup()}
              style={styles.primaryButtonFull}
            >
              <Text style={styles.primaryText}>I arrived at the shop</Text>
            </Pressable>
          ) : null}
          {active.taskStatus === 'AT_PICKUP' ? (
            <>
              <TextInput
                accessibilityLabel="Merchant pickup code"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={setPickupCode}
                placeholder="6-digit pickup code"
                style={styles.input}
                value={pickupCode}
              />
              <Pressable
                disabled={busy || pickupCode.length !== 6}
                onPress={() => void verifyPickup()}
                style={styles.primaryButtonFull}
              >
                <Text style={styles.primaryText}>Verify package handover</Text>
              </Pressable>
            </>
          ) : null}
          {active.taskStatus === 'PICKED_UP' ? (
            <Pressable
              disabled={busy}
              onPress={() => void departPickup()}
              style={styles.primaryButtonFull}
            >
              <Text style={styles.primaryText}>Start customer delivery</Text>
            </Pressable>
          ) : null}
          {active.taskStatus === 'IN_TRANSIT' ? (
            <Pressable
              disabled={busy}
              onPress={() => void arriveDrop()}
              style={styles.primaryButtonFull}
            >
              <Text style={styles.primaryText}>I arrived at the customer</Text>
            </Pressable>
          ) : null}
          {active.taskStatus === 'AT_DROP' ? (
            <>
              <Text style={styles.codDue}>Collect exactly {money(active.totalPaise)}</Text>
              <TextInput
                accessibilityLabel="Collected COD amount"
                keyboardType="decimal-pad"
                onChangeText={setCodAmount}
                placeholder="COD amount"
                style={styles.input}
                value={codAmount}
              />
              <TextInput
                accessibilityLabel="Customer delivery OTP"
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={setDeliveryOtp}
                placeholder="6-digit delivery OTP"
                secureTextEntry
                style={styles.input}
                value={deliveryOtp}
              />
              <Pressable
                disabled={busy || deliveryOtp.length !== 6}
                onPress={() => void complete()}
                style={styles.primaryButtonFull}
              >
                <Text style={styles.primaryText}>Verify COD and complete</Text>
              </Pressable>
            </>
          ) : null}

          <TextInput
            accessibilityLabel="Operational note"
            multiline
            onChangeText={setProblemNote}
            placeholder="Optional note for operations"
            style={[styles.input, styles.noteInput]}
            value={problemNote}
          />
          {active.taskStatus === 'ASSIGNED' || active.taskStatus === 'AT_PICKUP' ? (
            <Pressable
              disabled={busy}
              onPress={() => void release('VEHICLE_ISSUE')}
              style={styles.warningButton}
            >
              <Text style={styles.warningText}>Release before pickup</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={busy}
            onPress={() =>
              void reportProblem(active.taskStatus === 'AT_DROP' ? 'CUSTOMER_UNAVAILABLE' : 'OTHER')
            }
            style={styles.dangerButton}
          >
            <Text style={styles.dangerText}>Report a delivery problem</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

export function AuthenticatedCaptainDeliveryScreen() {
  const session = useCaptainApiSession();
  const client = useMemo(
    () => new HttpCaptainDeliveryClient(session.apiBaseUrl, () => session.getAccessToken()),
    [session],
  );
  const presenceClient = useMemo(
    () => new HttpCaptainPresenceClient(session.apiBaseUrl, () => session.getAccessToken()),
    [session],
  );
  const locationProvider = useMemo(() => new ExpoCaptainLocationProvider(), []);
  return (
    <CaptainDeliveryScreen
      client={client}
      locationProvider={locationProvider}
      presenceClient={presenceClient}
    />
  );
}

const styles = StyleSheet.create({
  screen: { padding: 20, gap: 14, backgroundColor: '#FFF8F2', flexGrow: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFF8F2',
  },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: '#8A4B20' },
  title: { fontSize: 28, fontWeight: '800', color: '#2F1B12' },
  notice: { padding: 12, borderRadius: 12, backgroundColor: '#FFE8E3', color: '#8B1E13' },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0D9C8',
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#2F1B12' },
  meta: { fontSize: 14, color: '#6B5143' },
  address: { fontSize: 15, color: '#38261D', lineHeight: 21 },
  earning: { fontSize: 17, fontWeight: '800', color: '#176B3A' },
  cod: { fontSize: 13, fontWeight: '700', color: '#8A4B20' },
  codDue: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF1D6',
    fontSize: 18,
    fontWeight: '900',
    color: '#70420C',
  },
  timer: { fontSize: 18, fontWeight: '900', color: '#B33B24' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionsRow: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#D85B2A',
  },
  primaryButtonFull: {
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#D85B2A',
  },
  primaryText: { fontWeight: '800', color: '#FFFFFF' },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C77950',
    backgroundColor: '#FFFDFC',
  },
  secondaryText: { fontWeight: '700', color: '#8A3E1B' },
  warningButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF1D6',
  },
  warningText: { fontWeight: '800', color: '#70420C' },
  dangerButton: { alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#FFE4E0' },
  dangerText: { fontWeight: '800', color: '#8B1E13' },
  input: {
    borderWidth: 1,
    borderColor: '#D7B79F',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2F1B12',
  },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  empty: {
    gap: 12,
    alignItems: 'center',
    padding: 24,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: '#2F1B12' },
});
