import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useMerchantApiSession } from '../auth/merchant-api-session';
import { MerchantBarcodeScanner } from '../barcode/merchant-barcode-scanner';
import { AsyncStorageMerchantInventoryCache } from './merchant-inventory.cache';
import { HttpMerchantInventoryClient } from './merchant-inventory.client';
import { AsyncStorageMerchantOfflineSaleQueue } from './merchant-offline-sale.queue';
import {
  MerchantInventoryError,
  type MerchantBarcodeInventory,
  type MerchantInventoryCachePort,
  type MerchantInventoryPort,
  type MerchantOfflineSalePaymentMethod,
  type MerchantOfflineSaleQueuePort,
  type MerchantShopSummary,
  type PendingMerchantOfflineSale,
} from './merchant-inventory.types';

const PAYMENT_METHODS: readonly MerchantOfflineSalePaymentMethod[] = [
  'CASH',
  'UPI',
  'CARD',
  'OTHER',
];

function defaultIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function toPaise(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/u.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(paise) ? paise : null;
}

function money(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function errorMessage(error: MerchantInventoryError): string {
  switch (error.kind) {
    case 'AUTHENTICATION':
      return 'Your merchant session expired. Sign in again.';
    case 'FORBIDDEN':
      return 'This inventory is not available to your merchant account.';
    case 'NOT_FOUND':
      return 'No owned inventory variant matches this barcode.';
    case 'VALIDATION':
      return 'Review the barcode and sale values, then retry.';
    case 'CONFLICT':
      return 'Inventory changed while this sale was being recorded. Refresh and retry.';
    case 'TRANSPORT':
      return 'You appear to be offline.';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'Inventory is temporarily unavailable. Retry shortly.';
    case 'MALFORMED_RESPONSE':
    case 'UNKNOWN':
      return 'The inventory response could not be verified.';
  }
}

function asInventoryError(error: unknown): MerchantInventoryError {
  return error instanceof MerchantInventoryError
    ? error
    : new MerchantInventoryError('UNKNOWN', null, false);
}

export function MerchantInventoryWorkflow({
  client,
  queue,
  cache,
  createIdempotencyKey = defaultIdempotencyKey,
  syncIntervalMs = 15_000,
}: {
  readonly client: MerchantInventoryPort;
  readonly queue: MerchantOfflineSaleQueuePort;
  readonly cache: MerchantInventoryCachePort;
  readonly createIdempotencyKey?: () => string;
  readonly syncIntervalMs?: number;
}) {
  const [shop, setShop] = useState<MerchantShopSummary | null>(null);
  const [loadingShop, setLoadingShop] = useState(true);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [inventory, setInventory] = useState<MerchantBarcodeInventory | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [saleBusy, setSaleBusy] = useState(false);
  const saleRunning = useRef(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const syncRunning = useRef(false);
  const mounted = useRef(true);
  const [pendingEntries, setPendingEntries] = useState<readonly PendingMerchantOfflineSale[]>([]);
  const pendingCount = pendingEntries.length;
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<MerchantOfflineSalePaymentMethod>('CASH');
  const [failure, setFailure] = useState<MerchantInventoryError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [usingCachedInventory, setUsingCachedInventory] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const entries = await queue.list();
    if (mounted.current) setPendingEntries(entries);
  }, [queue]);

  const syncPendingSales = useCallback(async () => {
    if (syncRunning.current) return;
    syncRunning.current = true;
    setSyncBusy(true);
    try {
      const result = await queue.sync(client);
      if (!mounted.current) return;
      setPendingEntries(result.remaining);

      if (result.completed.length > 0) {
        setNotice(
          `${String(result.completed.length)} queued sale${
            result.completed.length === 1 ? '' : 's'
          } synchronized.`,
        );

        if (shop !== null && inventory !== null) {
          const completedForCurrent = [...result.completed]
            .reverse()
            .find((entry) => entry.pending.input.items[0]?.variantId === inventory.variant.id);
          if (completedForCurrent !== undefined) {
            const synchronizedInventory = {
              ...inventory,
              balance: completedForCurrent.result.balance,
            };
            setInventory(synchronizedInventory);
            setUsingCachedInventory(false);
            try {
              await cache.put(shop.id, synchronizedInventory);
            } catch {
              // A cache write must never turn an already committed server sale
              // into a failed or duplicated merchant command.
            }
          }
        }
      }
    } catch (error: unknown) {
      if (mounted.current) setFailure(asInventoryError(error));
    } finally {
      syncRunning.current = false;
      if (mounted.current) setSyncBusy(false);
    }
  }, [cache, client, inventory, queue, shop]);

  useEffect(() => {
    void refreshPendingCount()
      .then(syncPendingSales)
      .catch((error: unknown) => {
        if (mounted.current) setFailure(asInventoryError(error));
      });
    const interval = setInterval(() => {
      void syncPendingSales();
    }, syncIntervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncPendingSales();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refreshPendingCount, syncIntervalMs, syncPendingSales]);

  const loadShop = useCallback(async () => {
    setLoadingShop(true);
    setFailure(null);
    try {
      const shops = await client.listOwnedShops();
      if (!mounted.current) return;
      if (shops.length === 0) {
        setShop(null);
        setFailure(new MerchantInventoryError('NOT_FOUND', 'SHOP_NOT_FOUND', false));
      } else {
        setShop(shops[0] ?? null);
      }
    } catch (error: unknown) {
      if (mounted.current) setFailure(asInventoryError(error));
    } finally {
      if (mounted.current) setLoadingShop(false);
    }
  }, [client]);

  useEffect(() => {
    void loadShop();
  }, [loadShop]);

  const lookup = useCallback(
    async (rawBarcode: string) => {
      const value = rawBarcode.trim();
      if (shop === null || value.length === 0 || value.length > 255) {
        setFailure(new MerchantInventoryError('VALIDATION', 'BARCODE_REQUIRED', false));
        return;
      }
      setLookupBusy(true);
      setFailure(null);
      setNotice(null);
      setUsingCachedInventory(false);
      try {
        const result = await client.lookupBarcode(shop.id, value);
        if (!mounted.current) return;
        setInventory(result);
        setBarcode(result.scannedBarcode);
        try {
          await cache.put(shop.id, result);
        } catch {
          setNotice('Inventory loaded, but this device could not update its offline cache.');
        }
      } catch (error: unknown) {
        const inventoryError = asInventoryError(error);
        const cached =
          inventoryError.retryable || inventoryError.kind === 'TRANSPORT'
            ? await cache.get(shop.id, value)
            : null;
        if (!mounted.current) return;
        if (cached !== null) {
          setInventory(cached);
          setBarcode(cached.scannedBarcode);
          setUsingCachedInventory(true);
          setNotice('Offline: using the last synchronized barcode record.');
        } else {
          setInventory(null);
          setFailure(inventoryError);
        }
      } finally {
        if (mounted.current) setLookupBusy(false);
      }
    },
    [cache, client, shop],
  );

  const recordSale = useCallback(async () => {
    if (saleRunning.current || shop === null || inventory === null) return;
    const parsedQuantity = Number(quantity);
    const unitPricePaise = toPaise(unitPrice);
    const discountPaise = toPaise(discount);
    const taxPaise = toPaise(tax);
    const gross =
      Number.isSafeInteger(parsedQuantity) && unitPricePaise !== null
        ? parsedQuantity * unitPricePaise
        : -1;

    if (
      !Number.isSafeInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      unitPricePaise === null ||
      unitPricePaise < 0 ||
      discountPaise === null ||
      discountPaise < 0 ||
      taxPaise === null ||
      taxPaise < 0 ||
      discountPaise > gross
    ) {
      setFailure(new MerchantInventoryError('VALIDATION', 'INVALID_SALE_VALUES', false));
      return;
    }

    if (parsedQuantity > inventory.balance.availableQuantity) {
      setFailure(new MerchantInventoryError('VALIDATION', 'INSUFFICIENT_AVAILABLE_STOCK', false));
      return;
    }

    saleRunning.current = true;
    const idempotencyKey = createIdempotencyKey();
    const input = {
      shopId: shop.id,
      customerPhone: customerPhone.trim().length === 0 ? null : customerPhone.trim(),
      taxPaise,
      paymentMethod,
      items: [
        {
          variantId: inventory.variant.id,
          quantity: parsedQuantity,
          unitPricePaise,
          discountPaise,
          identificationMethod: 'BARCODE' as const,
        },
      ] as const,
    };

    setSaleBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const result = await client.createOfflineSale(input, idempotencyKey);
      if (!mounted.current) return;
      const synchronizedInventory = { ...inventory, balance: result.balance };
      setInventory(synchronizedInventory);
      setUsingCachedInventory(false);
      try {
        await cache.put(shop.id, synchronizedInventory);
      } catch {
        // The server sale is authoritative. Never retry it solely because a
        // non-authoritative device cache write failed.
      }
      setNotice(
        `Sale ${result.saleNumber} recorded. Available stock: ${String(
          result.balance.availableQuantity,
        )}.`,
      );
    } catch (error: unknown) {
      const inventoryError = asInventoryError(error);
      if (inventoryError.retryable || inventoryError.kind === 'TRANSPORT') {
        let pending: readonly PendingMerchantOfflineSale[];
        try {
          pending = await queue.enqueue({
            id: idempotencyKey,
            idempotencyKey,
            input,
            barcode: inventory.scannedBarcode,
            productName: inventory.product.name,
            createdAt: new Date().toISOString(),
          });
        } catch {
          if (mounted.current) {
            setFailure(new MerchantInventoryError('UNKNOWN', 'OFFLINE_QUEUE_UNAVAILABLE', false));
          }
          return;
        }
        if (!mounted.current) return;
        setPendingEntries(pending);
        const optimisticBalance = {
          ...inventory.balance,
          stockOnHand: Math.max(0, inventory.balance.stockOnHand - parsedQuantity),
          availableQuantity: Math.max(0, inventory.balance.availableQuantity - parsedQuantity),
        };
        const optimisticInventory = {
          ...inventory,
          balance: optimisticBalance,
        };
        setInventory(optimisticInventory);
        setUsingCachedInventory(true);
        try {
          await cache.put(shop.id, optimisticInventory);
        } catch {
          // The durable command queue remains the source of truth even when
          // optional cached lookup data cannot be updated.
        }
        setNotice(
          'Offline sale saved on this device. It will synchronize automatically after reconnection.',
        );
      } else if (mounted.current) {
        setFailure(inventoryError);
      }
    } finally {
      saleRunning.current = false;
      if (mounted.current) setSaleBusy(false);
    }
  }, [
    cache,
    client,
    createIdempotencyKey,
    customerPhone,
    discount,
    inventory,
    paymentMethod,
    quantity,
    queue,
    shop,
    tax,
    unitPrice,
  ]);

  const removePendingSale = useCallback(
    async (id: string) => {
      const remaining = await queue.remove(id);
      if (!mounted.current) return;
      setPendingEntries(remaining);

      if (shop !== null && inventory !== null) {
        try {
          const refreshed = await client.lookupBarcode(shop.id, inventory.scannedBarcode);
          if (!mounted.current) return;
          setInventory(refreshed);
          setUsingCachedInventory(false);
          try {
            await cache.put(shop.id, refreshed);
          } catch {
            // The refreshed server value remains valid for this session.
          }
          setNotice('Pending offline sale removed and inventory refreshed.');
          return;
        } catch {
          // The command is removed even when the device is still offline. The
          // last safe cached balance remains visible until the next lookup.
        }
      }

      if (mounted.current) {
        setNotice(
          'Pending offline sale removed. Refresh the barcode before recording another sale.',
        );
      }
    },
    [cache, client, inventory, queue, shop],
  );

  if (loadingShop) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading merchant inventory" size="large" />
      </View>
    );
  }

  if (shop === null) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="header" style={styles.title}>
          Inventory unavailable
        </Text>
        {failure === null ? null : (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage(failure)}
          </Text>
        )}
        <Pressable
          accessibilityLabel="Retry loading merchant shop"
          accessibilityRole="button"
          onPress={() => {
            void loadShop();
          }}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>
          Inventory scanner
        </Text>
        <Text style={styles.subtitle}>
          {shop.name} · {shop.shopCode}
        </Text>

        <View style={styles.syncCard}>
          <Text style={styles.syncTitle}>
            {pendingCount === 0
              ? 'All offline sales synchronized'
              : `${String(pendingCount)} offline sale${pendingCount === 1 ? '' : 's'} pending`}
          </Text>
          <Pressable
            accessibilityLabel="Synchronize pending offline sales"
            accessibilityRole="button"
            disabled={syncBusy}
            onPress={() => {
              void syncPendingSales();
            }}
            style={[styles.smallAction, syncBusy ? styles.disabled : null]}
          >
            <Text style={styles.smallActionText}>{syncBusy ? 'Syncing…' : 'Sync now'}</Text>
          </Pressable>
        </View>

        {pendingEntries.length === 0 ? null : (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>Pending offline sales</Text>
            {pendingEntries.map((entry) => (
              <View key={entry.id} style={styles.pendingItem}>
                <View style={styles.pendingCopy}>
                  <Text style={styles.pendingProduct}>{entry.productName}</Text>
                  <Text style={styles.pendingMeta}>
                    {entry.barcode} · Qty {String(entry.input.items[0]?.quantity ?? 0)}
                  </Text>
                  <Text style={styles.pendingMeta}>
                    Attempts {String(entry.attemptCount)}
                    {entry.lastErrorCode === null ? '' : ` · ${entry.lastErrorCode}`}
                    {entry.blocked ? ' · Needs review' : ''}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`Remove pending sale for ${entry.productName}`}
                  accessibilityRole="button"
                  onPress={() => {
                    void removePendingSale(entry.id);
                  }}
                  style={styles.removeAction}
                >
                  <Text style={styles.removeActionText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {failure === null ? null : (
          <View accessibilityLiveRegion="polite" style={styles.error}>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {errorMessage(failure)}
            </Text>
          </View>
        )}
        {notice === null ? null : (
          <View accessibilityLiveRegion="polite" style={styles.notice}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        <Pressable
          accessibilityLabel="Open product barcode scanner"
          accessibilityRole="button"
          onPress={() => {
            setScannerVisible(true);
          }}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>Scan barcode</Text>
        </Pressable>

        <TextInput
          accessibilityLabel="Enter product barcode manually"
          autoCapitalize="none"
          editable={!lookupBusy}
          onChangeText={setBarcode}
          onSubmitEditing={() => {
            void lookup(barcode);
          }}
          placeholder="Enter EAN, UPC, Code 128 or QR value"
          returnKeyType="search"
          style={styles.input}
          value={barcode}
        />
        <Pressable
          accessibilityLabel="Look up entered product barcode"
          accessibilityRole="button"
          disabled={lookupBusy}
          onPress={() => {
            void lookup(barcode);
          }}
          style={[styles.secondary, lookupBusy ? styles.disabled : null]}
        >
          <Text style={styles.secondaryText}>{lookupBusy ? 'Looking up…' : 'Look up barcode'}</Text>
        </Pressable>

        {inventory === null ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No barcode selected</Text>
            <Text style={styles.emptyCopy}>
              Scan or enter a barcode to inspect variant-level stock and record a shop sale.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{inventory.product.name}</Text>
              {usingCachedInventory ? <Text style={styles.cachedBadge}>CACHED</Text> : null}
            </View>
            <Text style={styles.meta}>
              {[inventory.product.brand, inventory.variant.colourName, inventory.variant.sizeLabel]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text style={styles.meta}>SKU {inventory.variant.sku}</Text>
            <Text style={styles.barcodeValue}>{inventory.scannedBarcode}</Text>
            <View style={styles.balanceGrid}>
              <Text style={styles.balance}>On hand {String(inventory.balance.stockOnHand)}</Text>
              <Text style={styles.balance}>
                Reserved {String(inventory.balance.reservedQuantity)}
              </Text>
              <Text style={styles.balance}>
                Damaged {String(inventory.balance.damagedQuantity)}
              </Text>
              <Text style={styles.available}>
                Available {String(inventory.balance.availableQuantity)}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Record physical shop sale</Text>
            <TextInput
              accessibilityLabel="Offline sale quantity"
              keyboardType="number-pad"
              onChangeText={setQuantity}
              placeholder="Quantity"
              style={styles.input}
              value={quantity}
            />
            <TextInput
              accessibilityLabel="Offline sale unit price in rupees"
              keyboardType="decimal-pad"
              onChangeText={setUnitPrice}
              placeholder="Unit price ₹"
              style={styles.input}
              value={unitPrice}
            />
            <TextInput
              accessibilityLabel="Offline sale discount in rupees"
              keyboardType="decimal-pad"
              onChangeText={setDiscount}
              placeholder="Discount ₹"
              style={styles.input}
              value={discount}
            />
            <TextInput
              accessibilityLabel="Offline sale tax in rupees"
              keyboardType="decimal-pad"
              onChangeText={setTax}
              placeholder="Tax ₹"
              style={styles.input}
              value={tax}
            />
            <TextInput
              accessibilityLabel="Offline sale customer phone optional"
              keyboardType="phone-pad"
              onChangeText={setCustomerPhone}
              placeholder="Customer phone (optional)"
              style={styles.input}
              value={customerPhone}
            />

            <Text style={styles.fieldLabel}>Payment method</Text>
            <View style={styles.paymentRow}>
              {PAYMENT_METHODS.map((method) => (
                <Pressable
                  accessibilityLabel={`Use ${method} payment`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: paymentMethod === method }}
                  key={method}
                  onPress={() => {
                    setPaymentMethod(method);
                  }}
                  style={[styles.payment, paymentMethod === method ? styles.paymentSelected : null]}
                >
                  <Text
                    style={[
                      styles.paymentText,
                      paymentMethod === method ? styles.paymentSelectedText : null,
                    ]}
                  >
                    {method}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.estimate}>
              Estimated line total:{' '}
              {(() => {
                const price = toPaise(unitPrice);
                const saleDiscount = toPaise(discount);
                const saleTax = toPaise(tax);
                const saleQuantity = Number(quantity);
                return price !== null &&
                  saleDiscount !== null &&
                  saleTax !== null &&
                  Number.isSafeInteger(saleQuantity) &&
                  saleQuantity >= 1
                  ? money(Math.max(0, saleQuantity * price - saleDiscount + saleTax))
                  : '—';
              })()}
            </Text>

            <Pressable
              accessibilityLabel="Record offline barcode sale"
              accessibilityRole="button"
              disabled={saleBusy}
              onPress={() => {
                void recordSale();
              }}
              style={[styles.primary, saleBusy ? styles.disabled : null]}
            >
              <Text style={styles.primaryText}>{saleBusy ? 'Recording…' : 'Record sale'}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <MerchantBarcodeScanner
        onClose={() => {
          setScannerVisible(false);
        }}
        onScanned={(value) => {
          setScannerVisible(false);
          setBarcode(value);
          void lookup(value);
        }}
        visible={scannerVisible}
      />
    </>
  );
}

export function DefaultMerchantInventory() {
  const session = useMerchantApiSession();
  const client = useMemo(
    () => new HttpMerchantInventoryClient(session.apiBaseUrl, session.getAccessToken),
    [session.apiBaseUrl, session.getAccessToken],
  );
  const queue = useMemo(() => new AsyncStorageMerchantOfflineSaleQueue(), []);
  const cache = useMemo(() => new AsyncStorageMerchantInventoryCache(), []);
  return <MerchantInventoryWorkflow cache={cache} client={client} queue={queue} />;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 18, paddingBottom: 120, backgroundColor: '#FFF8F2' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#FFF8F2',
  },
  title: { color: '#241B16', fontSize: 27, fontWeight: '900' },
  subtitle: { marginTop: 5, color: '#665A52', fontSize: 15 },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    padding: 13,
    borderRadius: 14,
    backgroundColor: '#E7F3EC',
  },
  syncTitle: { flex: 1, color: '#235E42', fontWeight: '800' },
  smallAction: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  smallActionText: { color: '#287A55', fontWeight: '900' },
  pendingCard: {
    marginTop: 12,
    padding: 13,
    borderRadius: 14,
    backgroundColor: '#FFF1D6',
  },
  pendingTitle: { color: '#6A4812', fontWeight: '900' },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8D3AA',
  },
  pendingCopy: { flex: 1 },
  pendingProduct: { color: '#241B16', fontWeight: '800' },
  pendingMeta: { marginTop: 3, color: '#6A4812', fontSize: 12 },
  removeAction: { paddingHorizontal: 10, paddingVertical: 8 },
  removeActionText: { color: '#8E3B46', fontWeight: '900' },
  error: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#FCE5E3' },
  errorText: { color: '#7A2929', lineHeight: 20, textAlign: 'center' },
  notice: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#E7F3EC' },
  noticeText: { color: '#235E42', lineHeight: 20 },
  primary: {
    alignItems: 'center',
    marginTop: 16,
    padding: 14,
    borderRadius: 13,
    backgroundColor: '#8E3B46',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  secondary: {
    alignItems: 'center',
    marginTop: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: '#8E3B46',
    borderRadius: 13,
  },
  secondaryText: { color: '#8E3B46', fontWeight: '900' },
  input: {
    minHeight: 48,
    marginTop: 12,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#CDBDB2',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#241B16',
  },
  disabled: { opacity: 0.48 },
  empty: {
    marginTop: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E4D7CE',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { color: '#241B16', fontSize: 17, fontWeight: '900' },
  emptyCopy: { marginTop: 7, color: '#665A52', lineHeight: 21 },
  card: {
    marginTop: 18,
    padding: 17,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: { flex: 1, color: '#241B16', fontSize: 20, fontWeight: '900' },
  cachedBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFF1D6',
    color: '#6A4812',
    fontSize: 11,
    fontWeight: '900',
  },
  meta: { marginTop: 5, color: '#665A52' },
  barcodeValue: {
    marginTop: 10,
    color: '#241B16',
    fontFamily: 'monospace',
    fontSize: 15,
    fontWeight: '800',
  },
  balanceGrid: { marginTop: 14, gap: 5 },
  balance: { color: '#665A52', fontWeight: '700' },
  available: { color: '#287A55', fontSize: 17, fontWeight: '900' },
  sectionTitle: { marginTop: 22, color: '#241B16', fontSize: 17, fontWeight: '900' },
  fieldLabel: { marginTop: 16, color: '#665A52', fontWeight: '800' },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  payment: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#CDBDB2',
    borderRadius: 999,
  },
  paymentSelected: { borderColor: '#8E3B46', backgroundColor: '#8E3B46' },
  paymentText: { color: '#665A52', fontSize: 12, fontWeight: '900' },
  paymentSelectedText: { color: '#FFFFFF' },
  estimate: { marginTop: 16, color: '#241B16', fontWeight: '800' },
});
