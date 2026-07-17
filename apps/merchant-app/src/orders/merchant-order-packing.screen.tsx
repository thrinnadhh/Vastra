import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  MerchantOrderError,
  type MerchantOrderDetail,
  type MerchantOrderPackingPort,
  type MerchantPackingList,
  type MerchantPackingVerificationInput,
} from './merchant-order.types';

function defaultAttemptKey(): string {
  return globalThis.crypto.randomUUID();
}

function asPackingError(error: unknown): MerchantOrderError {
  return error instanceof MerchantOrderError
    ? error
    : new MerchantOrderError('UNKNOWN', null, false);
}

function packingErrorMessage(error: MerchantOrderError): string {
  switch (error.kind) {
    case 'TRANSPORT':
      return 'You appear to be offline. Reconnect and retry without losing checklist progress.';
    case 'INVALID_STATE':
      return 'The order changed on the server. Refresh order details before continuing.';
    case 'NOT_FOUND':
    case 'FORBIDDEN':
      return 'This packing checklist is not available for your shop.';
    case 'AUTHENTICATION':
      return 'Your merchant session expired. Sign in again.';
    case 'VALIDATION':
      return 'The packing request was invalid. Review the barcode or checklist and retry.';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'Packing is temporarily unavailable. Your durable checklist is unchanged.';
    case 'MALFORMED_RESPONSE':
    case 'UNKNOWN':
      return 'We could not verify the packing result. Refresh the durable checklist.';
  }
}

function PackingError({ error }: { readonly error: MerchantOrderError }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.error}>
      <Text style={styles.errorText}>{packingErrorMessage(error)}</Text>
    </View>
  );
}

export function MerchantOrderPackingActions({
  order,
  packingClient,
  onOrderChanged,
  createIdempotencyKey = defaultAttemptKey,
}: {
  readonly order: MerchantOrderDetail;
  readonly packingClient: MerchantOrderPackingPort;
  readonly onOrderChanged: () => void;
  readonly createIdempotencyKey?: () => string;
}) {
  const [packingList, setPackingList] = useState<MerchantPackingList | null>(null);
  const [isLoading, setLoading] = useState(order.status === 'PACKING');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const [failure, setFailure] = useState<MerchantOrderError | null>(null);
  const [barcodes, setBarcodes] = useState<Readonly<Record<string, string>>>({});
  const [readyAttemptKey] = useState(createIdempotencyKey);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadPackingList = useCallback(() => {
    setLoading(true);
    setFailure(null);
    void packingClient.getPackingList(order.id).then(
      (list) => {
        if (!mounted.current) return;
        setPackingList(list);
        setLoading(false);
      },
      (error: unknown) => {
        if (!mounted.current) return;
        setFailure(asPackingError(error));
        setLoading(false);
      },
    );
  }, [order.id, packingClient]);

  useEffect(() => {
    if (order.status === 'PACKING') {
      void Promise.resolve().then(loadPackingList);
    }
  }, [loadPackingList, order.status]);

  if (order.status === 'READY_FOR_PICKUP') {
    return (
      <View
        accessible
        accessibilityLabel="Packing complete. Order ready for pickup"
        style={styles.complete}
      >
        <Text style={styles.completeTitle}>Ready for pickup</Text>
        <Text style={styles.completeCopy}>
          All required item verification is complete. This Sprint 6 flow ends here.
        </Text>
      </View>
    );
  }

  if (order.status !== 'MERCHANT_ACCEPTED' && order.status !== 'PACKING') return null;

  const startPacking = () => {
    if (busy.current) return;
    busy.current = true;
    setBusyAction('START');
    setFailure(null);
    void packingClient.startPacking(order.id).then(
      () => {
        if (!mounted.current) return;
        busy.current = false;
        setBusyAction(null);
        loadPackingList();
        onOrderChanged();
      },
      (error: unknown) => {
        if (!mounted.current) return;
        busy.current = false;
        setBusyAction(null);
        setFailure(asPackingError(error));
      },
    );
  };

  const verifyItem = (orderItemId: string, input: MerchantPackingVerificationInput) => {
    if (busy.current) return;
    if (input.method === 'BARCODE' && input.barcode.trim().length === 0) {
      setFailure(new MerchantOrderError('VALIDATION', 'BARCODE_REQUIRED', false));
      return;
    }
    busy.current = true;
    setBusyAction(`VERIFY:${orderItemId}`);
    setFailure(null);
    const request =
      input.method === 'BARCODE'
        ? { method: 'BARCODE' as const, barcode: input.barcode.trim() }
        : input;
    void packingClient.verifyPackingItem(order.id, orderItemId, request).then(
      () => {
        if (!mounted.current) return;
        busy.current = false;
        setBusyAction(null);
        loadPackingList();
      },
      (error: unknown) => {
        if (!mounted.current) return;
        busy.current = false;
        setBusyAction(null);
        setFailure(asPackingError(error));
      },
    );
  };

  const markReady = () => {
    if (busy.current || packingList?.allVerified !== true) return;
    busy.current = true;
    setBusyAction('READY');
    setFailure(null);
    void packingClient.markReadyForPickup(order.id, readyAttemptKey).then(
      () => {
        if (!mounted.current) return;
        busy.current = false;
        setBusyAction(null);
        onOrderChanged();
      },
      (error: unknown) => {
        if (!mounted.current) return;
        busy.current = false;
        setBusyAction(null);
        setFailure(asPackingError(error));
      },
    );
  };

  if (order.status === 'MERCHANT_ACCEPTED' && packingList === null) {
    return (
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          Packing
        </Text>
        <Text style={styles.copy}>
          Start the durable packing checklist for this accepted order.
        </Text>
        {failure === null ? null : <PackingError error={failure} />}
        <Pressable
          accessibilityLabel={
            failure?.retryable === true ? 'Retry start packing' : 'Start packing merchant order'
          }
          accessibilityRole="button"
          disabled={busyAction !== null}
          onPress={startPacking}
          style={[styles.primary, busyAction !== null ? styles.disabled : null]}
        >
          <Text style={styles.primaryText}>
            {busyAction === 'START' ? 'Starting…' : 'Start packing'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (packingList === null && isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator accessibilityLabel="Loading merchant packing checklist" />
        <Text style={styles.loadingCopy}>Loading durable packing checklist…</Text>
      </View>
    );
  }

  if (packingList === null && failure !== null) {
    return (
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          Packing checklist unavailable
        </Text>
        <PackingError error={failure} />
        <Pressable
          accessibilityLabel="Retry merchant packing checklist"
          accessibilityRole="button"
          onPress={loadPackingList}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Retry checklist</Text>
        </Pressable>
      </View>
    );
  }

  if (packingList === null) return null;

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        Packing checklist
      </Text>
      <Text
        accessibilityLabel={`${String(packingList.verifiedLines)} of ${String(packingList.totalLines)} packing lines verified`}
        style={styles.progress}
      >
        {packingList.verifiedLines} of {packingList.totalLines} verified
      </Text>
      {failure === null ? null : <PackingError error={failure} />}

      {packingList.items.map((item) => {
        const verified = item.fulfilmentStatus === 'VERIFIED' || item.fulfilmentStatus === 'PACKED';
        const mismatched = item.verification?.result === 'MISMATCH';
        return (
          <View key={item.orderItemId} style={styles.item}>
            <Text style={styles.itemName}>{item.productName}</Text>
            <Text style={styles.itemMeta}>
              {[item.colour, item.size, item.sku].filter(Boolean).join(' · ')} · Qty {item.quantity}
            </Text>
            <Text
              style={[
                styles.itemStatus,
                verified ? styles.verified : mismatched ? styles.mismatch : null,
              ]}
            >
              {mismatched ? 'BARCODE MISMATCH' : verified ? 'VERIFIED' : 'PENDING VERIFICATION'}
            </Text>
            {mismatched ? (
              <Text style={styles.mismatchCopy}>
                Scanned barcode did not match this ordered variant. Verify the correct item.
              </Text>
            ) : null}
            {verified ? null : (
              <>
                <TextInput
                  accessibilityLabel={`Barcode for ${item.productName}`}
                  editable={busyAction === null}
                  onChangeText={(value) => {
                    setBarcodes((current) => ({ ...current, [item.orderItemId]: value }));
                  }}
                  placeholder="Scan or enter barcode"
                  style={styles.input}
                  value={barcodes[item.orderItemId] ?? ''}
                />
                <View style={styles.row}>
                  <Pressable
                    accessibilityLabel={`Verify ${item.productName} by barcode`}
                    accessibilityRole="button"
                    disabled={busyAction !== null}
                    onPress={() => {
                      verifyItem(item.orderItemId, {
                        method: 'BARCODE',
                        barcode: barcodes[item.orderItemId] ?? '',
                      });
                    }}
                    style={styles.secondary}
                  >
                    <Text style={styles.secondaryText}>Verify barcode</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Manually confirm ${item.productName}`}
                    accessibilityRole="button"
                    disabled={busyAction !== null}
                    onPress={() => {
                      verifyItem(item.orderItemId, { method: 'MANUAL' });
                    }}
                    style={styles.secondary}
                  >
                    <Text style={styles.secondaryText}>Confirm manually</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        );
      })}

      {!packingList.allVerified ? (
        <View
          accessible
          accessibilityLabel="Ready for pickup blocked. Complete every packing verification"
          style={styles.incomplete}
        >
          <Text style={styles.incompleteTitle}>Verification incomplete</Text>
          <Text style={styles.copy}>
            Ready for Pickup remains blocked until every ordered line is verified.
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityLabel={
          failure?.retryable === true
            ? 'Retry ready for pickup with same idempotency key'
            : 'Mark merchant order ready for pickup'
        }
        accessibilityRole="button"
        accessibilityState={{ disabled: !packingList.allVerified || busyAction !== null }}
        disabled={!packingList.allVerified || busyAction !== null}
        onPress={markReady}
        style={[
          styles.primary,
          !packingList.allVerified || busyAction !== null ? styles.disabled : null,
        ]}
      >
        <Text style={styles.primaryText}>
          {busyAction === 'READY' ? 'Marking ready…' : 'Ready for pickup'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Refresh merchant packing checklist"
        accessibilityRole="button"
        disabled={isLoading || busyAction !== null}
        onPress={loadPackingList}
        style={styles.refresh}
      >
        <Text style={styles.secondaryText}>Refresh checklist</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: '#FFFFFF' },
  title: { color: '#241B16', fontSize: 18, fontWeight: '800' },
  copy: { marginTop: 6, color: '#665A52', lineHeight: 20 },
  loadingCopy: { marginTop: 10, color: '#665A52', textAlign: 'center' },
  progress: { marginTop: 7, color: '#287A55', fontWeight: '800' },
  item: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EFE5DE' },
  itemName: { color: '#241B16', fontSize: 15, fontWeight: '800' },
  itemMeta: { marginTop: 4, color: '#665A52', fontSize: 13 },
  itemStatus: {
    alignSelf: 'flex-start',
    marginTop: 8,
    color: '#7A6B61',
    fontSize: 11,
    fontWeight: '900',
  },
  verified: { color: '#287A55' },
  mismatch: { color: '#A33A32' },
  mismatchCopy: { marginTop: 5, color: '#A33A32', fontSize: 13, lineHeight: 18 },
  input: {
    minHeight: 46,
    marginTop: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#CDBDB2',
    borderRadius: 11,
    color: '#241B16',
  },
  row: { flexDirection: 'row', gap: 8 },
  primary: {
    alignItems: 'center',
    marginTop: 15,
    padding: 14,
    borderRadius: 13,
    backgroundColor: '#287A55',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  secondary: {
    flex: 1,
    alignItems: 'center',
    marginTop: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: '#8E3B46',
    borderRadius: 11,
  },
  secondaryText: { color: '#8E3B46', fontSize: 13, fontWeight: '800' },
  refresh: { alignItems: 'center', marginTop: 10, padding: 10 },
  disabled: { opacity: 0.45 },
  incomplete: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#FFF1D6' },
  incompleteTitle: { color: '#6A4812', fontWeight: '800' },
  error: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#FCE5E3' },
  errorText: { color: '#7A2929', lineHeight: 20 },
  complete: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#E7F3EC' },
  completeTitle: { color: '#235E42', fontWeight: '800' },
  completeCopy: { marginTop: 4, color: '#235E42', lineHeight: 20 },
});
