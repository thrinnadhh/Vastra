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
  type MerchantSettlementGateway,
  MerchantSettlementAlreadyExistsError,
  MerchantSettlementGatewayUnavailableError,
  MerchantSettlementIdempotencyConflictError,
  MerchantSettlementNotEligibleError,
} from './merchant-settlement.gateway';
import type {
  MerchantSettlementDetail,
  MerchantSettlementEligibility,
  MerchantSettlementResponse,
} from './merchant-settlement.types';
import {
  MerchantSettlementIdempotencyKeyRequiredError,
  MerchantSettlementValidationError,
  parseCreateMerchantSettlementInput,
  parseMerchantSettlementPeriod,
  requireMerchantSettlementUuid,
} from './merchant-settlement.validation';
import { MERCHANT_SETTLEMENT_GATEWAY } from './finance-ledger.tokens';

@Injectable()
export class MerchantSettlementService {
  public constructor(
    @Inject(MERCHANT_SETTLEMENT_GATEWAY)
    private readonly gateway: MerchantSettlementGateway,
  ) {}

  public async getEligibility(
    shopId: unknown,
    periodStart: unknown,
    periodEnd: unknown,
  ): Promise<MerchantSettlementResponse<MerchantSettlementEligibility>> {
    try {
      return this.success(
        await this.gateway.getEligibility(
          parseMerchantSettlementPeriod(shopId, periodStart, periodEnd),
        ),
      );
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async create(
    context: AuthenticatedRequestContext,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<MerchantSettlementResponse<MerchantSettlementDetail>> {
    try {
      const input = parseCreateMerchantSettlementInput(body, idempotencyKey);
      return this.success(await this.gateway.create(context.actor.id, input));
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async get(
    settlementId: unknown,
  ): Promise<MerchantSettlementResponse<MerchantSettlementDetail>> {
    try {
      const result = await this.gateway.get(requireMerchantSettlementUuid(settlementId));
      if (result === null) throw new NotFoundException('Merchant settlement was not found');
      return this.success(result);
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  private success<T>(data: T): MerchantSettlementResponse<T> {
    return { success: true, data, meta: { requestId: null } };
  }

  private rethrowMapped(error: unknown): never {
    if (
      error instanceof MerchantSettlementValidationError ||
      error instanceof MerchantSettlementIdempotencyKeyRequiredError
    ) {
      throw new BadRequestException('Merchant settlement request is invalid');
    }
    if (
      error instanceof MerchantSettlementNotEligibleError ||
      error instanceof MerchantSettlementIdempotencyConflictError ||
      error instanceof MerchantSettlementAlreadyExistsError
    ) {
      throw new ConflictException('Merchant settlement conflicts with current state');
    }
    if (error instanceof NotFoundException) throw error;
    if (error instanceof MerchantSettlementGatewayUnavailableError) {
      throw new ServiceUnavailableException('Merchant settlement service is unavailable');
    }
    throw error;
  }
}
