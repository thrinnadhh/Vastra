import type { IdempotencyKey } from './types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function asIdempotencyKey(value: string): IdempotencyKey {
  if (!UUID_PATTERN.test(value)) throw new TypeError('Idempotency keys must be UUIDs');
  return value as IdempotencyKey;
}

export function createIdempotencyKey(generator: () => string): IdempotencyKey {
  return asIdempotencyKey(generator());
}

export type MutationIntentTerminalReason =
  'SUCCESS' | 'REJECTED' | 'CANCELLED' | 'AUTHORITATIVE_REPLACEMENT';

export interface ActiveMutationIntent {
  readonly intentId: string;
  readonly idempotencyKey: IdempotencyKey;
}

export class MutationIntentConflictError extends Error {
  public constructor() {
    super('A different mutation intent is already unresolved');
    this.name = 'MutationIntentConflictError';
  }
}

export class MutationIntentController {
  private active: ActiveMutationIntent | null = null;

  public constructor(private readonly generateKey: () => IdempotencyKey) {}

  public begin(intentId: string): IdempotencyKey {
    if (intentId.trim().length === 0) throw new TypeError('Mutation intent ID must not be empty');
    if (this.active !== null) {
      if (this.active.intentId !== intentId) throw new MutationIntentConflictError();
      return this.active.idempotencyKey;
    }
    const idempotencyKey = this.generateKey();
    this.active = Object.freeze({ intentId, idempotencyKey });
    return idempotencyKey;
  }

  public markUnknownOutcome(intentId: string): void {
    if (this.active?.intentId !== intentId) throw new MutationIntentConflictError();
  }

  public clear(reason: MutationIntentTerminalReason): void {
    void reason;
    this.active = null;
  }

  public current(): ActiveMutationIntent | null {
    return this.active;
  }
}
