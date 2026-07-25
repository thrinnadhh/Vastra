import { CaptainDeliveryApiError } from './captain-delivery.client';
import type {
  CaptainDelivery,
  CaptainDeliveryPort,
  DeliveryCompletion,
  DeliveryLocation,
  DeliveryProblem,
  DeliveryProblemReason,
  DeliveryRejectionReason,
  DeliveryRelease,
  DeliveryReleaseReason,
  DeliveryTaskStatus,
} from './captain-delivery.types';

const TASK_STATUS_RANK: Readonly<Record<DeliveryTaskStatus, number>> = {
  OFFERED: 0,
  ASSIGNED: 1,
  AT_PICKUP: 2,
  PICKED_UP: 3,
  IN_TRANSIT: 4,
  AT_DROP: 5,
};

const SESSION_ERROR_CODES = new Set([
  'AUTHENTICATION_REQUIRED',
  'AUTHENTICATION_INVALID',
  'SESSION_EXPIRED',
]);

type SessionExpiryHandler = () => Promise<void> | void;

function hasReached(delivery: CaptainDelivery, expected: DeliveryTaskStatus): boolean {
  return TASK_STATUS_RANK[delivery.taskStatus] >= TASK_STATUS_RANK[expected];
}

function isSessionError(error: unknown): error is CaptainDeliveryApiError {
  return error instanceof CaptainDeliveryApiError && SESSION_ERROR_CODES.has(error.code);
}

/**
 * Adds client-side delivery safety without changing server authority.
 *
 * - overlapping polling reads share one request;
 * - retries of the same logical mutation retain the first idempotency key;
 * - lifecycle races reconcile against the authoritative delivery projection;
 * - expired sessions are cleared locally before another protected screen is shown.
 */
export class ResilientCaptainDeliveryPort implements CaptainDeliveryPort {
  private readonly reads = new Map<string, Promise<unknown>>();
  private readonly attemptKeys = new Map<string, string>();

  public constructor(
    private readonly delegate: CaptainDeliveryPort,
    private readonly onSessionExpired: SessionExpiryHandler,
  ) {}

  public listOffers(): Promise<readonly CaptainDelivery[]> {
    return this.singleFlight('offers', () => this.delegate.listOffers());
  }

  public getActive(): Promise<CaptainDelivery | null> {
    return this.singleFlight('active', () => this.delegate.getActive());
  }

  public getTask(taskId: string): Promise<CaptainDelivery> {
    return this.singleFlight(`task:${taskId}`, () => this.delegate.getTask(taskId));
  }

  public async acceptOffer(
    assignmentId: string,
    idempotencyKey: string,
  ): Promise<CaptainDelivery> {
    return this.deliveryMutation(
      `accept:${assignmentId}`,
      idempotencyKey,
      (key) => this.delegate.acceptOffer(assignmentId, key),
      async () => {
        const active = await this.getActive();
        return active?.assignmentId === assignmentId && active.assignmentStatus === 'ACCEPTED'
          ? active
          : null;
      },
    );
  }

  public async rejectOffer(
    assignmentId: string,
    reason: DeliveryRejectionReason,
    idempotencyKey: string,
  ): Promise<void> {
    const attempt = `reject:${assignmentId}:${reason}`;
    const key = this.keyFor(attempt, idempotencyKey);

    try {
      await this.delegate.rejectOffer(assignmentId, reason, key);
      this.attemptKeys.delete(attempt);
    } catch (error: unknown) {
      if (await this.expireSession(error)) throw error;

      try {
        const offers = await this.listOffers();
        if (!offers.some((offer) => offer.assignmentId === assignmentId)) {
          this.attemptKeys.delete(attempt);
          return;
        }
      } catch {
        // Preserve the original mutation error and its retry-safe key.
      }

      this.clearNonRetryableAttempt(attempt, error);
      throw error;
    }
  }

  public arrivePickup(
    taskId: string,
    location: DeliveryLocation,
    idempotencyKey: string,
  ): Promise<CaptainDelivery> {
    return this.lifecycleMutation(
      taskId,
      'arrive-pickup',
      'AT_PICKUP',
      idempotencyKey,
      (key) => this.delegate.arrivePickup(taskId, location, key),
    );
  }

  public verifyPickup(
    taskId: string,
    pickupCode: string,
    idempotencyKey: string,
  ): Promise<CaptainDelivery> {
    return this.lifecycleMutation(
      taskId,
      'verify-pickup',
      'PICKED_UP',
      idempotencyKey,
      (key) => this.delegate.verifyPickup(taskId, pickupCode, key),
    );
  }

  public departPickup(
    taskId: string,
    location: DeliveryLocation | null,
    idempotencyKey: string,
  ): Promise<CaptainDelivery> {
    return this.lifecycleMutation(
      taskId,
      'depart-pickup',
      'IN_TRANSIT',
      idempotencyKey,
      (key) => this.delegate.departPickup(taskId, location, key),
    );
  }

  public arriveDrop(
    taskId: string,
    location: DeliveryLocation | null,
    idempotencyKey: string,
  ): Promise<CaptainDelivery> {
    return this.lifecycleMutation(
      taskId,
      'arrive-drop',
      'AT_DROP',
      idempotencyKey,
      (key) => this.delegate.arriveDrop(taskId, location, key),
    );
  }

  public complete(
    taskId: string,
    collectedAmountPaise: number,
    deliveryOtp: string,
    location: DeliveryLocation | null,
    idempotencyKey: string,
  ): Promise<DeliveryCompletion> {
    return this.nonReconciledMutation(`complete:${taskId}`, idempotencyKey, (key) =>
      this.delegate.complete(taskId, collectedAmountPaise, deliveryOtp, location, key),
    );
  }

  public reportProblem(
    taskId: string,
    reason: DeliveryProblemReason,
    note: string | null,
    location: DeliveryLocation | null,
    idempotencyKey: string,
  ): Promise<DeliveryProblem> {
    return this.nonReconciledMutation(`problem:${taskId}:${reason}`, idempotencyKey, (key) =>
      this.delegate.reportProblem(taskId, reason, note, location, key),
    );
  }

  public release(
    taskId: string,
    reason: DeliveryReleaseReason,
    note: string | null,
    location: DeliveryLocation | null,
    idempotencyKey: string,
  ): Promise<DeliveryRelease> {
    return this.nonReconciledMutation(`release:${taskId}:${reason}`, idempotencyKey, (key) =>
      this.delegate.release(taskId, reason, note, location, key),
    );
  }

  private lifecycleMutation(
    taskId: string,
    action: string,
    expectedStatus: DeliveryTaskStatus,
    idempotencyKey: string,
    operation: (key: string) => Promise<CaptainDelivery>,
  ): Promise<CaptainDelivery> {
    return this.deliveryMutation(
      `${action}:${taskId}`,
      idempotencyKey,
      operation,
      async () => {
        const delivery = await this.getTask(taskId);
        return hasReached(delivery, expectedStatus) ? delivery : null;
      },
    );
  }

  private async deliveryMutation(
    attempt: string,
    idempotencyKey: string,
    operation: (key: string) => Promise<CaptainDelivery>,
    reconcile: () => Promise<CaptainDelivery | null>,
  ): Promise<CaptainDelivery> {
    const key = this.keyFor(attempt, idempotencyKey);

    try {
      const delivery = await operation(key);
      this.attemptKeys.delete(attempt);
      return delivery;
    } catch (error: unknown) {
      if (await this.expireSession(error)) throw error;

      try {
        const delivery = await reconcile();
        if (delivery !== null) {
          this.attemptKeys.delete(attempt);
          return delivery;
        }
      } catch {
        // Preserve the original mutation error and its retry-safe key.
      }

      this.clearNonRetryableAttempt(attempt, error);
      throw error;
    }
  }

  private async nonReconciledMutation<T>(
    attempt: string,
    idempotencyKey: string,
    operation: (key: string) => Promise<T>,
  ): Promise<T> {
    const key = this.keyFor(attempt, idempotencyKey);

    try {
      const result = await operation(key);
      this.attemptKeys.delete(attempt);
      return result;
    } catch (error: unknown) {
      await this.expireSession(error);
      this.clearNonRetryableAttempt(attempt, error);
      throw error;
    }
  }

  private keyFor(attempt: string, proposedKey: string): string {
    const current = this.attemptKeys.get(attempt);
    if (current !== undefined) return current;
    this.attemptKeys.set(attempt, proposedKey);
    return proposedKey;
  }

  private clearNonRetryableAttempt(attempt: string, error: unknown): void {
    if (error instanceof CaptainDeliveryApiError && !error.retryable) {
      this.attemptKeys.delete(attempt);
    }
  }

  private async expireSession(error: unknown): Promise<boolean> {
    if (!isSessionError(error)) return false;

    this.attemptKeys.clear();
    this.reads.clear();
    await Promise.resolve(this.onSessionExpired()).catch(() => undefined);
    return true;
  }

  private singleFlight<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const current = this.reads.get(key) as Promise<T> | undefined;
    if (current !== undefined) return current;

    const request = operation().finally(() => {
      if (this.reads.get(key) === request) this.reads.delete(key);
    });
    this.reads.set(key, request);
    return request;
  }
}
