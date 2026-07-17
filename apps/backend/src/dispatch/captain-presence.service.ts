import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type CaptainPresenceGateway,
  CaptainPresenceGatewayUnavailableError,
  CaptainPresenceInvalidRequestError,
  CaptainPresenceLocationStaleError,
  CaptainPresenceNotEligibleError,
  CaptainPresenceRateLimitedError,
  CaptainPresenceSampleConflictError,
  CaptainPresenceStateConflictError,
} from './captain-presence.gateway';
import {
  createCaptainLocationRateLimitedException,
  createCaptainLocationSampleConflictException,
  createCaptainLocationStaleException,
  createCaptainNotEligibleException,
  createCaptainPresenceInvalidException,
  createCaptainPresenceStateConflictException,
  createCaptainPresenceUnavailableException,
} from './captain-presence-http-error';
import { CAPTAIN_PRESENCE_GATEWAY } from './captain-presence.tokens';
import type {
  CaptainAvailabilityResponse,
  CaptainLocationResponse,
} from './captain-presence.types';
import {
  CaptainPresenceValidationError,
  parseCaptainAvailabilityBody,
  parseCaptainLocationBody,
} from './captain-presence.validation';

@Injectable()
export class CaptainPresenceService {
  public constructor(
    @Inject(CAPTAIN_PRESENCE_GATEWAY)
    private readonly gateway: CaptainPresenceGateway,
  ) {}

  public async setAvailability(
    context: AuthenticatedRequestContext,
    body: unknown,
  ): Promise<CaptainAvailabilityResponse> {
    try {
      const requestedStatus = parseCaptainAvailabilityBody(body);
      const availability = await this.gateway.setAvailability(
        context.actor.id,
        requestedStatus,
      );

      return {
        success: true,
        data: { availability },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrow(error);
    }
  }

  public async updateLocation(
    context: AuthenticatedRequestContext,
    body: unknown,
  ): Promise<CaptainLocationResponse> {
    try {
      const command = parseCaptainLocationBody(context.actor.id, body);
      const location = await this.gateway.updateLocation(command);

      return {
        success: true,
        data: { location },
        meta: { requestId: null },
      };
    } catch (error: unknown) {
      return this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (
      error instanceof CaptainPresenceValidationError ||
      error instanceof CaptainPresenceInvalidRequestError
    ) {
      throw createCaptainPresenceInvalidException();
    }

    if (error instanceof CaptainPresenceNotEligibleError) {
      throw createCaptainNotEligibleException();
    }

    if (error instanceof CaptainPresenceStateConflictError) {
      throw createCaptainPresenceStateConflictException();
    }

    if (error instanceof CaptainPresenceLocationStaleError) {
      throw createCaptainLocationStaleException();
    }

    if (error instanceof CaptainPresenceSampleConflictError) {
      throw createCaptainLocationSampleConflictException();
    }

    if (error instanceof CaptainPresenceRateLimitedError) {
      throw createCaptainLocationRateLimitedException();
    }

    if (error instanceof CaptainPresenceGatewayUnavailableError) {
      throw createCaptainPresenceUnavailableException();
    }

    throw error;
  }
}
