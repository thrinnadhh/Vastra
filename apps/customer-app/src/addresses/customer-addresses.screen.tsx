import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CustomerNetworkStateBoundary } from '../ui/customer-network-state';
import { resolveCustomerNetworkState } from '../ui/resolve-customer-network-state';
import { createCustomerAddressIdempotencyKey } from './customer-address-idempotency';
import { CustomerAddressFormScreen } from './customer-address-form.screen';
import { resolveAddressAfterDeletion } from './customer-address-selection';
import type {
  CustomerAddress,
  CustomerAddressFailureKind,
  CustomerAddressPort,
} from './customer-address.types';

interface CustomerAddressesScreenProps {
  readonly addressPort: CustomerAddressPort;
  readonly mode?: 'MANAGE' | 'CHECKOUT';
  readonly selectedAddressId?: string | null;
  readonly onSelectedAddressChange?: (addressId: string | null) => void;
  readonly onInvalidateQuote?: () => void;
  readonly createIdempotencyKey?: () => string;
}

type ScreenMode =
  | { readonly kind: 'LIST' }
  | { readonly kind: 'ADD' }
  | { readonly kind: 'EDIT'; readonly address: CustomerAddress };

function failureCopy(kind: CustomerAddressFailureKind | null): string | null {
  switch (kind) {
    case null:
      return null;
    case 'OFFLINE':
      return 'Check your internet connection and try again.';
    case 'SESSION_EXPIRED':
      return 'Your session expired. Sign in again to manage delivery addresses.';
    case 'UNAUTHORIZED':
      return 'This account is not allowed to view these delivery addresses.';
    case 'CONTRACT':
      return 'Address information could not be verified safely.';
    case 'VALIDATION':
    case 'NOT_FOUND':
    case 'CONFLICT':
    case 'UNAVAILABLE':
    case 'UNKNOWN':
      return 'Delivery addresses could not be refreshed.';
  }
}

function serviceabilityCopy(
  serviceability: CustomerAddress['serviceability'],
  isStale: boolean,
): {
  readonly label: string;
  readonly description: string;
  readonly tone: 'GOOD' | 'BAD' | 'WARN';
} {
  if (isStale) {
    return {
      label: 'Serviceability stale',
      description:
        serviceability === 'SERVICEABLE'
          ? 'Last known as serviceable. Refresh before checkout.'
          : serviceability === 'UNSERVICEABLE'
            ? 'Last known as unserviceable. Refresh before checkout.'
            : 'Serviceability has not been confirmed. Refresh before checkout.',
      tone: 'WARN',
    };
  }
  if (serviceability === 'SERVICEABLE') {
    return { label: 'Serviceable', description: 'Available for checkout.', tone: 'GOOD' };
  }
  if (serviceability === 'UNSERVICEABLE') {
    return {
      label: 'Unserviceable',
      description: 'This address cannot be used for checkout right now.',
      tone: 'BAD',
    };
  }
  return {
    label: 'Serviceability unknown',
    description: 'Refresh before using this address for checkout.',
    tone: 'WARN',
  };
}

function AuthFailure({
  kind,
  onRetry,
}: {
  readonly kind: 'SESSION_EXPIRED' | 'UNAUTHORIZED';
  readonly onRetry: () => void;
}) {
  const sessionExpired = kind === 'SESSION_EXPIRED';
  return (
    <View accessible accessibilityLiveRegion="assertive" style={styles.centerState}>
      <Text accessibilityRole="header" style={styles.title}>
        {sessionExpired ? 'Session expired' : 'Address access unavailable'}
      </Text>
      <Text style={styles.stateCopy}>{failureCopy(kind)}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.primaryAction}>
        <Text style={styles.primaryActionText}>
          {sessionExpired ? 'Try after signing in' : 'Try again'}
        </Text>
      </Pressable>
    </View>
  );
}

export function CustomerAddressesScreen({
  addressPort,
  mode = 'MANAGE',
  selectedAddressId = null,
  onSelectedAddressChange = () => undefined,
  onInvalidateQuote = () => undefined,
  createIdempotencyKey = createCustomerAddressIdempotencyKey,
}: CustomerAddressesScreenProps) {
  const [screenMode, setScreenMode] = useState<ScreenMode>({ kind: 'LIST' });
  const [addresses, setAddresses] = useState<readonly CustomerAddress[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isStale, setStale] = useState(false);
  const [failureKind, setFailureKind] = useState<CustomerAddressFailureKind | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingAddressId, setPendingAddressId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<CustomerAddress | null>(null);
  const activeMutationKeys = useRef(new Map<string, string>());

  const load = useCallback(
    async (preserveVisible: boolean): Promise<readonly CustomerAddress[] | null> => {
      setLoading(true);
      setFailureKind(null);
      const result = await addressPort.list();
      setLoading(false);
      if (result.kind === 'FAILURE') {
        setFailureKind(result.failureKind);
        setStale(preserveVisible);
        return null;
      }
      setAddresses(result.addresses);
      setStale(false);
      return result.addresses;
    },
    [addressPort],
  );

  useEffect(() => {
    let active = true;
    void addressPort.list().then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.kind === 'FAILURE') {
        setFailureKind(result.failureKind);
        return;
      }
      setAddresses(result.addresses);
    });
    return () => {
      active = false;
    };
  }, [addressPort]);

  const mutationKey = (scope: string): string => {
    const existing = activeMutationKeys.current.get(scope);
    if (existing !== undefined) return existing;
    const created = createIdempotencyKey();
    activeMutationKeys.current.set(scope, created);
    return created;
  };

  const choose = (address: CustomerAddress): void => {
    if (mode === 'CHECKOUT' && address.serviceability !== 'SERVICEABLE') {
      setStatusMessage('Choose a serviceable address for checkout.');
      return;
    }
    if (isStale && mode === 'CHECKOUT') {
      setStatusMessage('Refresh serviceability before continuing to checkout.');
      return;
    }
    if (address.id !== selectedAddressId) {
      onInvalidateQuote();
      onSelectedAddressChange(address.id);
    }
    setStatusMessage(`${address.label ?? 'Delivery address'} selected.`);
  };

  const setDefault = async (address: CustomerAddress): Promise<void> => {
    if (pendingAddressId !== null) return;
    const scope = `default:${address.id}`;
    setPendingAddressId(address.id);
    setStatusMessage(null);
    const result = await addressPort.setDefault(address.id, mutationKey(scope));
    setPendingAddressId(null);
    if (result.kind === 'FAILURE') {
      if (result.failureKind === 'CONFLICT' || result.failureKind === 'NOT_FOUND') {
        activeMutationKeys.current.delete(scope);
        await load(true);
      }
      setFailureKind(result.failureKind);
      setStatusMessage('The default address was not changed.');
      return;
    }
    activeMutationKeys.current.delete(scope);
    setAddresses((current) =>
      current.map((item) => ({ ...item, isDefault: item.id === result.address.id })),
    );
    setStatusMessage('Default address updated.');
  };

  const remove = async (address: CustomerAddress): Promise<void> => {
    if (pendingAddressId !== null) return;
    const scope = `delete:${address.id}`;
    setDeleteCandidate(null);
    setPendingAddressId(address.id);
    setStatusMessage(null);
    const result = await addressPort.remove(address.id, mutationKey(scope));
    setPendingAddressId(null);
    if (result.kind === 'FAILURE') {
      if (result.failureKind === 'CONFLICT' || result.failureKind === 'NOT_FOUND') {
        activeMutationKeys.current.delete(scope);
        await load(true);
      }
      setFailureKind(result.failureKind);
      setStatusMessage('The address was not deleted.');
      return;
    }

    activeMutationKeys.current.delete(scope);
    const remaining = addresses.filter((item) => item.id !== result.deletedAddressId);
    setAddresses(remaining);
    const affectedSelection = selectedAddressId === result.deletedAddressId || address.isDefault;
    const appliedFallbackId = affectedSelection
      ? resolveAddressAfterDeletion(remaining, result.defaultAddressId, mode)
      : selectedAddressId;
    if (affectedSelection && appliedFallbackId !== selectedAddressId) {
      onInvalidateQuote();
      onSelectedAddressChange(appliedFallbackId);
    }
    setStatusMessage('Address deleted.');
    const refreshed = await load(true);
    if (refreshed !== null && affectedSelection) {
      const refreshedFallbackId = resolveAddressAfterDeletion(
        refreshed,
        result.defaultAddressId,
        mode,
      );
      if (refreshedFallbackId !== appliedFallbackId) {
        onInvalidateQuote();
        onSelectedAddressChange(refreshedFallbackId);
      }
    }
  };

  if (screenMode.kind === 'ADD' || screenMode.kind === 'EDIT') {
    return (
      <CustomerAddressFormScreen
        address={screenMode.kind === 'EDIT' ? screenMode.address : null}
        addressPort={addressPort}
        createIdempotencyKey={createIdempotencyKey}
        onCancel={() => {
          setScreenMode({ kind: 'LIST' });
        }}
        onSaved={(savedAddress) => {
          setScreenMode({ kind: 'LIST' });
          setAddresses((current) => {
            const withoutSaved = current.filter((address) => address.id !== savedAddress.id);
            const updated = [savedAddress, ...withoutSaved].map((address) =>
              savedAddress.isDefault
                ? { ...address, isDefault: address.id === savedAddress.id }
                : address,
            );
            return updated;
          });
          setStatusMessage('Address saved. Serviceability is server-confirmed.');
          void load(true);
        }}
      />
    );
  }

  if (
    addresses.length === 0 &&
    (failureKind === 'SESSION_EXPIRED' || failureKind === 'UNAUTHORIZED')
  ) {
    return <AuthFailure kind={failureKind} onRetry={() => void load(false)} />;
  }

  const networkState = resolveCustomerNetworkState({
    isLoading,
    isOffline: failureKind === 'OFFLINE',
    errorMessage: failureCopy(failureKind),
    hasData: addresses.length > 0,
    hasStaleData: isStale,
    loadingLabel: 'Loading delivery addresses',
    emptyTitle: 'No delivery addresses yet',
    emptyMessage: 'Add an address to check delivery serviceability and continue checkout.',
    emptyActionLabel: 'Add address',
  });

  return (
    <CustomerNetworkStateBoundary
      onEmptyAction={() => {
        setScreenMode({ kind: 'ADD' });
      }}
      onRetry={() => void load(addresses.length > 0)}
      state={networkState}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              {mode === 'CHECKOUT' ? 'Choose delivery address' : 'Delivery addresses'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'CHECKOUT'
                ? 'Only a server-confirmed serviceable address can continue.'
                : 'Serviceability is checked by Vastra, not calculated on this device.'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Refresh addresses"
              accessibilityRole="button"
              accessibilityState={{ busy: isLoading, disabled: isLoading }}
              disabled={isLoading}
              onPress={() => void load(addresses.length > 0)}
              style={styles.refreshAction}
            >
              <Text style={styles.refreshActionText}>{isLoading ? 'Refreshing…' : 'Refresh'}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Add address"
              accessibilityRole="button"
              onPress={() => {
                setScreenMode({ kind: 'ADD' });
              }}
              style={styles.addAction}
            >
              <Text style={styles.addActionText}>Add</Text>
            </Pressable>
          </View>
        </View>

        {statusMessage === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.statusMessage}>
            {statusMessage}
          </Text>
        )}

        {addresses.map((address) => {
          const serviceability = serviceabilityCopy(address.serviceability, isStale);
          const selected = address.id === selectedAddressId;
          const pending = pendingAddressId === address.id;
          const checkoutDisabled =
            mode === 'CHECKOUT' &&
            (isStale || address.serviceability !== 'SERVICEABLE' || pendingAddressId !== null);
          return (
            <View
              accessibilityLabel={`${address.label ?? 'Address'}. ${serviceability.label}${address.isDefault ? '. Default address' : ''}${selected ? '. Selected' : ''}`}
              key={address.id}
              style={[styles.card, selected ? styles.selectedCard : null]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{address.label ?? 'Delivery address'}</Text>
                  <Text style={styles.recipient}>{address.recipientName}</Text>
                </View>
                {address.isDefault ? <Text style={styles.defaultBadge}>DEFAULT</Text> : null}
              </View>
              <Text style={styles.addressLine}>{address.line1}</Text>
              {address.line2 === null ? null : (
                <Text style={styles.addressLine}>{address.line2}</Text>
              )}
              <Text style={styles.addressLine}>
                {address.area}, {address.city}, {address.state} {address.postalCode}
              </Text>
              <Text style={styles.addressLine}>{address.phoneNumber}</Text>
              <View
                style={[
                  styles.serviceBadge,
                  serviceability.tone === 'GOOD'
                    ? styles.serviceGood
                    : serviceability.tone === 'BAD'
                      ? styles.serviceBad
                      : styles.serviceWarn,
                ]}
              >
                <Text style={styles.serviceLabel}>{serviceability.label}</Text>
                <Text style={styles.serviceDescription}>{serviceability.description}</Text>
              </View>

              <View style={styles.actions}>
                <Pressable
                  accessibilityLabel={selected ? 'Address selected' : 'Select address'}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: checkoutDisabled, selected }}
                  disabled={checkoutDisabled}
                  onPress={() => {
                    choose(address);
                  }}
                  style={[styles.primarySmall, checkoutDisabled ? styles.disabled : null]}
                >
                  <Text style={styles.primarySmallText}>{selected ? 'Selected' : 'Select'}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Edit ${address.label ?? 'address'}`}
                  accessibilityRole="button"
                  disabled={pendingAddressId !== null}
                  onPress={() => {
                    setScreenMode({ kind: 'EDIT', address });
                  }}
                  style={styles.secondarySmall}
                >
                  <Text style={styles.secondarySmallText}>Edit</Text>
                </Pressable>
                {!address.isDefault ? (
                  <Pressable
                    accessibilityLabel={`Set ${address.label ?? 'address'} as default`}
                    accessibilityRole="button"
                    accessibilityState={{ busy: pending }}
                    disabled={pendingAddressId !== null}
                    onPress={() => void setDefault(address)}
                    style={styles.secondarySmall}
                  >
                    <Text style={styles.secondarySmallText}>
                      {pending ? 'Saving…' : 'Set default'}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityLabel={`Delete ${address.label ?? 'address'}`}
                  accessibilityRole="button"
                  disabled={pendingAddressId !== null}
                  onPress={() => {
                    setDeleteCandidate(address);
                  }}
                  style={styles.dangerSmall}
                >
                  <Text style={styles.dangerSmallText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          setDeleteCandidate(null);
        }}
        presentationStyle="overFullScreen"
        testID="delete-address-modal"
        transparent
        visible={deleteCandidate !== null}
      >
        <View accessible accessibilityViewIsModal style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Text accessibilityRole="header" style={styles.confirmTitle}>
              Delete this address?
            </Text>
            <Text style={styles.stateCopy}>
              Vastra will use the server-selected default address, then the first eligible address
              in API order. Checkout quote state will be invalidated.
            </Text>
            <Pressable
              accessibilityLabel="Confirm delete address"
              accessibilityRole="button"
              disabled={deleteCandidate === null}
              onPress={() => {
                if (deleteCandidate !== null) void remove(deleteCandidate);
              }}
              style={styles.dangerAction}
            >
              <Text style={styles.primaryActionText}>Delete address</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Cancel delete address"
              accessibilityRole="button"
              onPress={() => {
                setDeleteCandidate(null);
              }}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondarySmallText}>Keep address</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </CustomerNetworkStateBoundary>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 48, backgroundColor: '#F7F8FA' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1 },
  title: { color: '#101828', fontSize: 25, fontWeight: '800' },
  subtitle: { marginTop: 5, color: '#667085', fontSize: 14, lineHeight: 20 },
  headerActions: { alignItems: 'flex-end', gap: 8 },
  refreshAction: {
    minWidth: 78,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
  },
  refreshActionText: { color: '#344054', fontWeight: '800' },
  addAction: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#8E3B46',
  },
  addActionText: { color: '#FFFFFF', fontWeight: '800' },
  statusMessage: {
    marginTop: 14,
    padding: 10,
    borderRadius: 8,
    color: '#344054',
    backgroundColor: '#EAECF0',
    fontWeight: '700',
  },
  card: {
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAECF0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  selectedCard: { borderWidth: 2, borderColor: '#8E3B46' },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardCopy: { flex: 1 },
  cardTitle: { color: '#101828', fontSize: 18, fontWeight: '800' },
  recipient: { marginTop: 3, color: '#344054', fontSize: 15, fontWeight: '700' },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    color: '#175CD3',
    backgroundColor: '#EFF8FF',
    fontSize: 11,
    fontWeight: '900',
  },
  addressLine: { marginTop: 4, color: '#667085', fontSize: 14, lineHeight: 19 },
  serviceBadge: { marginTop: 12, padding: 10, borderRadius: 10 },
  serviceGood: { backgroundColor: '#ECFDF3' },
  serviceBad: { backgroundColor: '#FEF3F2' },
  serviceWarn: { backgroundColor: '#FFFAEB' },
  serviceLabel: { color: '#344054', fontSize: 13, fontWeight: '900' },
  serviceDescription: { marginTop: 2, color: '#475467', fontSize: 12 },
  actions: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primarySmall: {
    minHeight: 42,
    minWidth: 86,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#8E3B46',
    paddingHorizontal: 12,
  },
  primarySmallText: { color: '#FFFFFF', fontWeight: '800' },
  secondarySmall: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 9,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  secondarySmallText: { color: '#344054', fontWeight: '800' },
  dangerSmall: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDA29B',
    borderRadius: 9,
    paddingHorizontal: 12,
    backgroundColor: '#FFF5F4',
  },
  dangerSmallText: { color: '#B42318', fontWeight: '800' },
  disabled: { opacity: 0.45 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  stateCopy: { marginTop: 9, color: '#667085', fontSize: 15, lineHeight: 22 },
  primaryAction: {
    minHeight: 48,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#8E3B46',
    paddingHorizontal: 18,
  },
  primaryActionText: { color: '#FFFFFF', fontWeight: '800' },
  confirmOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(16,24,40,0.52)',
  },
  confirmDialog: {
    width: '100%',
    maxWidth: 420,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  confirmTitle: { color: '#101828', fontSize: 21, fontWeight: '800' },
  dangerAction: {
    minHeight: 48,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#B42318',
  },
  secondaryAction: {
    minHeight: 46,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
});
