import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  MerchantInventoryError,
  type CompletedMerchantOfflineSale,
  type MerchantInventoryPort,
  type MerchantOfflineSaleQueuePort,
  type PendingMerchantOfflineSale,
} from './merchant-inventory.types';

const QUEUE_STORAGE_KEY = '@vastra/merchant/offline-sales/v1';

export interface MerchantQueueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePendingSale(value: unknown): PendingMerchantOfflineSale | null {
  if (!isRecord(value) || !isRecord(value['input'])) return null;
  const items = value['input']['items'];
  if (
    typeof value['id'] !== 'string' ||
    typeof value['idempotencyKey'] !== 'string' ||
    typeof value['barcode'] !== 'string' ||
    typeof value['productName'] !== 'string' ||
    typeof value['createdAt'] !== 'string' ||
    typeof value['attemptCount'] !== 'number' ||
    !Number.isSafeInteger(value['attemptCount']) ||
    value['attemptCount'] < 0 ||
    (value['lastAttemptAt'] !== null &&
      typeof value['lastAttemptAt'] !== 'string') ||
    (value['lastErrorCode'] !== null &&
      typeof value['lastErrorCode'] !== 'string') ||
    !Array.isArray(items) ||
    items.length !== 1
  ) {
    return null;
  }

  return {
    ...(value as unknown as PendingMerchantOfflineSale),
    blocked: typeof value['blocked'] === 'boolean' ? value['blocked'] : false,
  };
}

function parseQueue(raw: string | null): PendingMerchantOfflineSale[] {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const parsed = value.map(parsePendingSale);
    return parsed.every(
      (item): item is PendingMerchantOfflineSale => item !== null,
    )
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export class AsyncStorageMerchantOfflineSaleQueue
  implements MerchantOfflineSaleQueuePort
{
  private tail: Promise<void> = Promise.resolve();

  public constructor(
    private readonly storage: MerchantQueueStorage = AsyncStorage,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  public list(): Promise<readonly PendingMerchantOfflineSale[]> {
    return this.runExclusive(async () => this.load());
  }

  public remove(id: string): Promise<readonly PendingMerchantOfflineSale[]> {
    return this.runExclusive(async () => {
      const next = (await this.load()).filter((item) => item.id !== id);
      await this.save(next);
      return next;
    });
  }

  public enqueue(
    input: Omit<
      PendingMerchantOfflineSale,
      'attemptCount' | 'lastAttemptAt' | 'lastErrorCode' | 'blocked'
    >,
  ): Promise<readonly PendingMerchantOfflineSale[]> {
    return this.runExclusive(async () => {
      const queue = await this.load();
      const existing = queue.find(
        (item) => item.idempotencyKey === input.idempotencyKey,
      );
      if (existing !== undefined) return queue;
      const next = [
        ...queue,
        {
          ...input,
          attemptCount: 0,
          lastAttemptAt: null,
          lastErrorCode: null,
          blocked: false,
        },
      ];
      await this.save(next);
      return next;
    });
  }

  public sync(client: MerchantInventoryPort): Promise<{
    readonly remaining: readonly PendingMerchantOfflineSale[];
    readonly completed: readonly CompletedMerchantOfflineSale[];
  }> {
    return this.runExclusive(async () => {
      const queue = await this.load();
      const remaining: PendingMerchantOfflineSale[] = [];
      const completed: CompletedMerchantOfflineSale[] = [];

      for (const [index, pending] of queue.entries()) {
        if (pending.blocked) {
          remaining.push(pending);
          continue;
        }

        try {
          const result = await client.createOfflineSale(
            pending.input,
            pending.idempotencyKey,
          );
          completed.push({ pending, result });
        } catch (error: unknown) {
          const inventoryError =
            error instanceof MerchantInventoryError ? error : null;
          remaining.push({
            ...pending,
            attemptCount: pending.attemptCount + 1,
            lastAttemptAt: this.now(),
            lastErrorCode:
              inventoryError?.code ?? inventoryError?.kind ?? 'UNKNOWN',
            blocked: inventoryError?.retryable !== true,
          });

          if (inventoryError?.retryable === true) {
            remaining.push(...queue.slice(index + 1));
            break;
          }
        }
      }

      await this.save(remaining);
      return { remaining, completed };
    });
  }

  private async load(): Promise<PendingMerchantOfflineSale[]> {
    return parseQueue(await this.storage.getItem(QUEUE_STORAGE_KEY));
  }

  private save(queue: readonly PendingMerchantOfflineSale[]): Promise<void> {
    return this.storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release: (() => void) | undefined;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release?.();
    }
  }
}
