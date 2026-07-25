import { CaptainPresenceApiError } from './captain-presence.client';
import type {
  CaptainAvailabilityResult,
  CaptainAvailabilityStatus,
  CaptainLocationResult,
  CaptainLocationSample,
  CaptainPresencePort,
  CaptainRequestedAvailabilityStatus,
} from './captain-presence.types';

const SESSION_ERROR_CODES = new Set([
  'AUTHENTICATION_REQUIRED',
  'AUTHENTICATION_INVALID',
  'SESSION_EXPIRED',
]);

type SessionExpiryHandler = () => Promise<void> | void;

function isSessionError(error: unknown): error is CaptainPresenceApiError {
  return error instanceof CaptainPresenceApiError && SESSION_ERROR_CODES.has(error.code);
}

/**
 * Preserves the existing captain presence contract while making authentication expiry
 * deterministic and sharing overlapping availability reads.
 */
export class ResilientCaptainPresencePort implements CaptainPresencePort {
  private availabilityRead: Promise<CaptainAvailabilityStatus> | null = null;

  public constructor(
    private readonly delegate: CaptainPresencePort,
    private readonly onSessionExpired: SessionExpiryHandler,
  ) {}

  public getAvailability(): Promise<CaptainAvailabilityStatus> {
    if (this.availabilityRead !== null) return this.availabilityRead;

    const request = this.protect(() => this.delegate.getAvailability()).finally(() => {
      this.availabilityRead = null;
    });
    this.availabilityRead = request;
    return request;
  }

  public setAvailability(
    status: CaptainRequestedAvailabilityStatus,
  ): Promise<CaptainAvailabilityResult> {
    return this.protect(() => this.delegate.setAvailability(status));
  }

  public updateLocation(sample: CaptainLocationSample): Promise<CaptainLocationResult> {
    return this.protect(() => this.delegate.updateLocation(sample));
  }

  private async protect<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (isSessionError(error)) {
        this.availabilityRead = null;
        await Promise.resolve(this.onSessionExpired()).catch(() => undefined);
      }
      throw error;
    }
  }
}
