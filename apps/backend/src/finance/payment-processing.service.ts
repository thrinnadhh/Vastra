import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type PaymentProcessingGateway,
  PaymentProcessingGatewayUnavailableError,
  PaymentProcessingIdempotencyConflictError,
  PaymentProcessingNotFoundError,
  PaymentProcessingStateConflictError,
} from './payment-processing.gateway';
import type {
  PaymentEventRetryResult,
  PaymentProcessingResponse,
  PaymentProcessingSummary,
} from './payment-processing.types';
import { PAYMENT_PROCESSING_GATEWAY } from './payment.tokens';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

@Injectable()
export class PaymentProcessingService {
  public constructor(
    @Inject(PAYMENT_PROCESSING_GATEWAY)
    private readonly gateway: PaymentProcessingGateway,
  ) {}

  public async process(rawLimit: unknown): Promise<PaymentProcessingResponse<PaymentProcessingSummary>> {
    try {
      const limit = rawLimit === undefined ? 25 : Number(rawLimit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException();
      return this.success(await this.gateway.processBatch(limit));
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async retry(
    context: AuthenticatedRequestContext,
    rawEventId: unknown,
    rawIdempotencyKey: unknown,
    body: unknown,
  ): Promise<PaymentProcessingResponse<PaymentEventRetryResult>> {
    try {
      const eventId = Number(rawEventId);
      if (!Number.isSafeInteger(eventId) || eventId < 1) throw new BadRequestException();
      if (typeof rawIdempotencyKey !== 'string' || !UUID_PATTERN.test(rawIdempotencyKey)) {
        throw new BadRequestException();
      }
      if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new BadRequestException();
      const noteValue = (body as Record<string, unknown>)['note'];
      const note = noteValue === undefined || noteValue === null ? null : String(noteValue).trim();
      if (note !== null && (note.length === 0 || note.length > 1000)) throw new BadRequestException();
      return this.success(
        await this.gateway.retryFailedEvent(
          context.actor.id,
          eventId,
          rawIdempotencyKey.toLowerCase(),
          note,
        ),
      );
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  private success<T>(data: T): PaymentProcessingResponse<T> {
    return { success: true, data, meta: { requestId: null } };
  }

  private rethrowMapped(error: unknown): never {
    if (error instanceof BadRequestException) throw error;
    if (
      error instanceof PaymentProcessingStateConflictError ||
      error instanceof PaymentProcessingIdempotencyConflictError
    ) {
      throw new ConflictException('Payment event conflicts with current state');
    }
    if (error instanceof PaymentProcessingNotFoundError) {
      throw new NotFoundException('Payment event was not found');
    }
    if (error instanceof PaymentProcessingGatewayUnavailableError) {
      throw new ServiceUnavailableException('Payment processing is unavailable');
    }
    throw error;
  }
}
