import type { QueryClient } from '@tanstack/react-query';

import { createVastraQueryClient } from './policies';
import type { AccountId, Actor, AuthorizationEpoch } from './types';

interface BasePartition {
  readonly actor: Actor;
  readonly accountId: AccountId;
}

export interface CustomerAccountPartition extends BasePartition {
  readonly actor: 'customer';
}

export interface CaptainAccountPartition extends BasePartition {
  readonly actor: 'captain';
}

export interface MerchantAccountPartition extends BasePartition {
  readonly actor: 'merchant';
  readonly shopId: string;
}

export interface AdminAccountPartition extends BasePartition {
  readonly actor: 'admin';
  readonly authorizationEpoch: AuthorizationEpoch;
}

export type AccountPartition =
  | CustomerAccountPartition
  | CaptainAccountPartition
  | MerchantAccountPartition
  | AdminAccountPartition;

export type QueryClientFactory = () => QueryClient;

function isSamePartition(left: AccountPartition, right: AccountPartition): boolean {
  if (left.actor !== right.actor || left.accountId !== right.accountId) return false;
  if (left.actor === 'merchant' && right.actor === 'merchant') return left.shopId === right.shopId;
  if (left.actor === 'admin' && right.actor === 'admin') {
    return left.authorizationEpoch === right.authorizationEpoch;
  }
  return true;
}

export class AccountPartitionedQueryClient {
  private partition: AccountPartition | null = null;
  private client: QueryClient | null = null;

  public constructor(private readonly createClient: QueryClientFactory = createVastraQueryClient) {}

  public async activate(partition: AccountPartition): Promise<QueryClient> {
    if (this.partition !== null && this.client !== null && isSamePartition(this.partition, partition)) {
      return this.client;
    }
    await this.clear();
    this.partition = Object.freeze({ ...partition });
    this.client = this.createClient();
    return this.client;
  }

  public async clear(): Promise<void> {
    const previous = this.client;
    this.partition = null;
    this.client = null;
    if (previous === null) return;
    try {
      await previous.cancelQueries();
    } finally {
      previous.clear();
    }
  }

  public currentClient(): QueryClient | null {
    return this.client;
  }

  public currentPartition(): AccountPartition | null {
    return this.partition;
  }
}
