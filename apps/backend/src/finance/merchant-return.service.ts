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
  type MerchantReturnGateway,
  MerchantReturnGatewayUnavailableError,
  MerchantReturnIdempotencyConflictError,
  MerchantReturnNotFoundError,
  MerchantReturnStateConflictError,
} from './merchant-return.gateway';
import type { MerchantReturnRecord, MerchantReturnResponse } from './merchant-return.types';
import {
  MerchantReturnValidationError,
  parseMerchantReturnCommand,
  parseMerchantReturnInspection,
  requireMerchantReturnUuid,
} from './merchant-return.validation';
import { MERCHANT_RETURN_GATEWAY } from './return-resolution.tokens';

@Injectable()
export class MerchantReturnService {
  public constructor(
    @Inject(MERCHANT_RETURN_GATEWAY)
    private readonly gateway: MerchantReturnGateway,
  ) {}

  public async list(
    context: AuthenticatedRequestContext,
    rawLimit: unknown,
  ): Promise<MerchantReturnResponse<readonly MerchantReturnRecord[]>> {
    try {
      const limit = rawLimit === undefined ? 25 : Number(rawLimit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
        throw new MerchantReturnValidationError();
      return this.success(await this.gateway.list(context.actor.id, limit));
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async get(
    context: AuthenticatedRequestContext,
    rawReturnId: unknown,
  ): Promise<MerchantReturnResponse<MerchantReturnRecord>> {
    try {
      const result = await this.gateway.get(
        context.actor.id,
        requireMerchantReturnUuid(rawReturnId),
      );
      if (result === null) throw new MerchantReturnNotFoundError();
      return this.success(result);
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async receive(
    context: AuthenticatedRequestContext,
    rawReturnId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<MerchantReturnResponse<MerchantReturnRecord>> {
    try {
      return this.success(
        await this.gateway.receive(
          context.actor.id,
          requireMerchantReturnUuid(rawReturnId),
          parseMerchantReturnCommand(body, idempotencyKey),
        ),
      );
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async inspect(
    context: AuthenticatedRequestContext,
    rawReturnId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<MerchantReturnResponse<MerchantReturnRecord>> {
    try {
      return this.success(
        await this.gateway.inspect(
          context.actor.id,
          requireMerchantReturnUuid(rawReturnId),
          parseMerchantReturnInspection(body, idempotencyKey),
        ),
      );
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  private success<T>(data: T): MerchantReturnResponse<T> {
    return { success: true, data, meta: { requestId: null } };
  }

  private rethrowMapped(error: unknown): never {
    if (error instanceof MerchantReturnValidationError)
      throw new BadRequestException('Merchant return request is invalid');
    if (
      error instanceof MerchantReturnStateConflictError ||
      error instanceof MerchantReturnIdempotencyConflictError
    ) {
      throw new ConflictException('Merchant return conflicts with current state');
    }
    if (error instanceof MerchantReturnNotFoundError)
      throw new NotFoundException('Merchant return was not found');
    if (error instanceof MerchantReturnGatewayUnavailableError)
      throw new ServiceUnavailableException('Merchant return service is unavailable');
    throw error;
  }
}
