import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  MerchantBarcodeInventory,
  MerchantInventoryCachePort,
} from './merchant-inventory.types';
import type { MerchantQueueStorage } from './merchant-offline-sale.queue';

const CACHE_STORAGE_KEY = '@vastra/merchant/barcode-inventory-cache/v1';
const MAX_CACHE_ENTRIES = 500;

interface CachedInventoryEntry {
  readonly key: string;
  readonly cachedAt: string;
  readonly inventory: MerchantBarcodeInventory;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCachedEntry(value: unknown): value is CachedInventoryEntry {
  if (!isRecord(value) || !isRecord(value['inventory'])) return false;
  const inventory = value['inventory'];
  return (
    typeof value['key'] === 'string' &&
    typeof value['cachedAt'] === 'string' &&
    typeof inventory['scannedBarcode'] === 'string' &&
    isRecord(inventory['barcode']) &&
    isRecord(inventory['product']) &&
    isRecord(inventory['variant']) &&
    isRecord(inventory['balance'])
  );
}

function parseEntries(raw: string | null): CachedInventoryEntry[] {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every(isCachedEntry) ? value : [];
  } catch {
    return [];
  }
}

function cacheKey(shopId: string, barcode: string): string {
  return `${shopId}:${barcode}`;
}

export class AsyncStorageMerchantInventoryCache implements MerchantInventoryCachePort {
  public constructor(
    private readonly storage: MerchantQueueStorage = AsyncStorage,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  public async get(shopId: string, barcode: string): Promise<MerchantBarcodeInventory | null> {
    const key = cacheKey(shopId, barcode);
    const entries = parseEntries(await this.storage.getItem(CACHE_STORAGE_KEY));
    return entries.find((entry) => entry.key === key)?.inventory ?? null;
  }

  public async put(shopId: string, inventory: MerchantBarcodeInventory): Promise<void> {
    const key = cacheKey(shopId, inventory.scannedBarcode);
    const entries = parseEntries(await this.storage.getItem(CACHE_STORAGE_KEY));
    const next = [
      {
        key,
        cachedAt: this.now(),
        inventory,
      },
      ...entries.filter((entry) => entry.key !== key),
    ].slice(0, MAX_CACHE_ENTRIES);
    await this.storage.setItem(CACHE_STORAGE_KEY, JSON.stringify(next));
  }
}
