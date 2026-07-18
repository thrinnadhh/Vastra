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
  type CustomerReturnGateway,
  CustomerReturnGatewayUnavailableError,
  CustomerReturnIdempotencyConflictError,
  CustomerReturnNotEligibleError,
  CustomerReturnNotFoundError,
  CustomerReturnQuantityConflictError,
} from './customer-return.gateway';
import type {
  CustomerReturnDetail,
  CustomerReturnEligibility,
  CustomerReturnResponse,
} from './customer-return.types';
import {
  CustomerReturnIdempotencyKeyRequiredError,
  CustomerReturnValidationError,
  parseCreateCustomerReturnInput,
  requireCustomerReturnUuid,
} from './customer-return.validation';
import { CUSTOMER_RETURN_GATEWAY } from './customer-return.tokens';

@Injectable()
export class CustomerReturnService {
  public constructor(
    @Inject(CUSTOMER_RETURN_GATEWAY)
    private readonly gateway: CustomerReturnGateway,
  ) {}

  public async getEligibility(
    context: AuthenticatedRequestContext,
    rawOrderId: unknown,
  ): Promise<CustomerReturnResponse<CustomerReturnEligibility>> {
    try {
      const result = await this.gateway.getEligibility(
        context.actor.id,
        requireCustomerReturnUuid(rawOrderId),
      );
      if (result === null) throw new CustomerReturnNotFoundError();
      return this.success(result);
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async create(
    context: AuthenticatedRequestContext,
    rawOrderId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<CustomerReturnResponse<CustomerReturnDetail>> {
    try {
      const orderId = requireCustomerReturnUuid(rawOrderId);
      const input = parseCreateCustomerReturnInput(body, idempotencyKey);
      return this.success(await this.gateway.create(context.actor.id, orderId, input));
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async get(
    context: AuthenticatedRequestContext,
    rawReturnId: unknown,
  ): Promise<CustomerReturnResponse<CustomerReturnDetail>> {
    try {
      const result = await this.gateway.get(
        context.actor.id,
        requireCustomerReturnUuid(rawReturnId),
      );
      if (result === null) throw new CustomerReturnNotFoundError();
      return this.success(result);
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  private success<T>(data: T): CustomerReturnResponse<T> {
    return { success: true, data, meta: { requestId: null } };
  }

  private rethrowMapped(error: unknown): never {
    if (
      error instanceof CustomerReturnValidationError ||
      error instanceof CustomerReturnIdempotencyKeyRequiredError
    ) {
      throw new BadRequestException('Customer return request is invalid');
    }
    if (
      error instanceof CustomerReturnNotEligibleError ||
      error instanceof CustomerReturnQuantityConflictError ||
      error instanceof CustomerReturnIdempotencyConflictError
    ) {
      throw new ConflictException('Customer return request conflicts with current state');
    }
    if (error instanceof CustomerReturnNotFoundError) {
      throw new NotFoundException('Customer return was not found');
    }
    if (error instanceof CustomerReturnGatewayUnavailableError) {
      throw new ServiceUnavailableException('Customer return service is unavailable');
    }
    throw error;
  }
}
