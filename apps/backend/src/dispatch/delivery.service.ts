import { Inject, Injectable, Logger } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  type DeliveryGateway,
  CaptainAlreadyAssignedError,
  CaptainNotAtPickupError,
  CaptainNotEligibleError,
  CodAmountMismatchError,
  DeliveryAccessDeniedError,
  DeliveryAlreadyAssignedError,
  DeliveryGatewayUnavailableError,
  DeliveryIdempotencyConflictError,
  DeliveryOfferExpiredError,
  DeliveryOfferNotFoundError,
  DeliveryOtpInvalidError,
  DeliveryRequestInvalidError,
  DeliverySecretLockedError,
  DeliveryStateConflictError,
  DeliveryTaskNotFoundError,
  PickupCodeInvalidError,
} from './delivery.gateway';
import {
  createCaptainAlreadyAssignedException,
  createCaptainNotAtPickupException,
  createCaptainNotEligibleException,
  createCodAmountMismatchException,
  createDeliveryAccessDeniedException,
  createDeliveryAlreadyAssignedException,
  createDeliveryIdempotencyConflictException,
  createDeliveryIdempotencyRequiredException,
  createDeliveryOfferExpiredException,
  createDeliveryOfferNotFoundException,
  createDeliveryOtpInvalidException,
  createDeliveryRequestInvalidException,
  createDeliverySecretLockedException,
  createDeliveryStateConflictException,
  createDeliveryTaskNotFoundException,
  createDeliveryUnavailableException,
  createPickupCodeInvalidException,
} from './delivery-http-error';
import { DELIVERY_GATEWAY } from './delivery.tokens';
import type {
  CaptainDeliveryResponse,
  DeliveryCompletionResponse,
  DeliveryMutationResponse,
  DeliveryOffersResponse,
  DeliveryProblemResponse,
  DeliveryRejectionResponse,
  DeliveryReleaseResponse,
  DeliverySecretResponse,
  DeliveryTrackingResponse,
  MerchantDeliveryResponse,
} from './delivery.types';
import {
  DeliveryIdempotencyKeyRequiredError,
  DeliveryValidationError,
  parseAdminAssignInput,
  parseAdminDeliveryOverrideInput,
  parseAdminReleaseInput,
  parseArrivePickupInput,
  parseCompleteDeliveryInput,
  parseIdempotencyKey,
  parseLifecycleLocationInput,
  parseProblemInput,
  parseRejectOfferInput,
  parseReleaseInput,
  parseUuid,
  parseVerifyPickupInput,
} from './delivery.validation';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  public constructor(
    @Inject(DELIVERY_GATEWAY)
    private readonly gateway: DeliveryGateway,
  ) {}

  public async listOffers(context: AuthenticatedRequestContext): Promise<DeliveryOffersResponse> {
    return this.execute(async () => ({
      success: true,
      data: { offers: await this.gateway.listOffers(context.actor.id) },
      meta: { requestId: null },
    }));
  }

  public async getActive(context: AuthenticatedRequestContext): Promise<CaptainDeliveryResponse> {
    return this.execute(async () => ({
      success: true,
      data: { delivery: await this.gateway.getActive(context.actor.id) },
      meta: { requestId: null },
    }));
  }

  public async getTask(
    context: AuthenticatedRequestContext,
    taskIdValue: unknown,
  ): Promise<CaptainDeliveryResponse> {
    return this.execute(async () => {
      const taskId = parseUuid(taskIdValue);
      const delivery = await this.gateway.getTask(context.actor.id, taskId);
      if (delivery === null) throw new DeliveryTaskNotFoundError();
      return { success: true, data: { delivery }, meta: { requestId: null } };
    });
  }

  public async acceptOffer(
    context: AuthenticatedRequestContext,
    assignmentIdValue: unknown,
    idempotencyKeyValue: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.execute(async () => {
      const assignmentId = parseUuid(assignmentIdValue);
      const idempotencyKey = parseIdempotencyKey(idempotencyKeyValue);
      const delivery = await this.gateway.acceptOffer(
        context.actor.id,
        assignmentId,
        idempotencyKey,
      );
      this.logger.log(
        `delivery offer accepted actorId=${context.actor.id} assignmentId=${assignmentId} taskId=${delivery.taskId} replayed=${String(delivery.replayed)}`,
      );
      return { success: true, data: { delivery }, meta: { requestId: null } };
    });
  }

  public async rejectOffer(
    context: AuthenticatedRequestContext,
    assignmentIdValue: unknown,
    idempotencyKeyValue: unknown,
    bodyValue: unknown,
  ): Promise<DeliveryRejectionResponse> {
    return this.execute(async () => {
      const command = parseRejectOfferInput(assignmentIdValue, idempotencyKeyValue, bodyValue);
      const rejection = await this.gateway.rejectOffer(
        context.actor.id,
        command.assignmentId,
        command.reason,
        command.idempotencyKey,
      );
      this.logger.log(
        `delivery offer rejected actorId=${context.actor.id} assignmentId=${command.assignmentId} reason=${command.reason} replayed=${String(rejection.replayed)}`,
      );
      return { success: true, data: { rejection }, meta: { requestId: null } };
    });
  }

  public async arrivePickup(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.deliveryMutation('arrived pickup', context, () =>
      this.gateway.arrivePickup(
        parseArrivePickupInput(context.actor.id, taskId, idempotencyKey, body),
      ),
    );
  }

  public async verifyPickup(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.deliveryMutation('pickup verified', context, () =>
      this.gateway.verifyPickup(
        parseVerifyPickupInput(context.actor.id, taskId, idempotencyKey, body),
      ),
    );
  }

  public async departPickup(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.deliveryMutation('departed pickup', context, () =>
      this.gateway.departPickup(
        parseLifecycleLocationInput(context.actor.id, taskId, idempotencyKey, body),
      ),
    );
  }

  public async arriveDrop(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.deliveryMutation('arrived customer', context, () =>
      this.gateway.arriveDrop(
        parseLifecycleLocationInput(context.actor.id, taskId, idempotencyKey, body),
      ),
    );
  }

  public async complete(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<DeliveryCompletionResponse> {
    return this.execute(async () => {
      const completion = await this.gateway.complete(
        parseCompleteDeliveryInput(context.actor.id, taskId, idempotencyKey, body),
      );
      this.logger.log(
        `delivery completed actorId=${context.actor.id} taskId=${completion.taskId} orderId=${completion.orderId} replayed=${String(completion.replayed)}`,
      );
      return { success: true, data: { completion }, meta: { requestId: null } };
    });
  }

  public async reportProblem(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<DeliveryProblemResponse> {
    return this.execute(async () => {
      const problem = await this.gateway.reportProblem(
        parseProblemInput(context.actor.id, taskId, idempotencyKey, body),
      );
      this.logger.warn(
        `delivery problem reported actorId=${context.actor.id} taskId=${problem.taskId} reason=${problem.reason} replayed=${String(problem.replayed)}`,
      );
      return { success: true, data: { problem }, meta: { requestId: null } };
    });
  }

  public async release(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<DeliveryReleaseResponse> {
    return this.execute(async () => {
      const release = await this.gateway.release(
        parseReleaseInput(context.actor.id, taskId, idempotencyKey, body),
      );
      this.logger.warn(
        `delivery released actorId=${context.actor.id} taskId=${release.taskId} reason=${release.reason} replayed=${String(release.replayed)}`,
      );
      return { success: true, data: { release }, meta: { requestId: null } };
    });
  }

  public async issuePickupCode(
    context: AuthenticatedRequestContext,
    orderIdValue: unknown,
  ): Promise<DeliverySecretResponse> {
    return this.execute(async () => ({
      success: true,
      data: {
        secret: await this.gateway.issuePickupCode(context.actor.id, parseUuid(orderIdValue)),
      },
      meta: { requestId: null },
    }));
  }

  public async issueDeliveryOtp(
    context: AuthenticatedRequestContext,
    orderIdValue: unknown,
  ): Promise<DeliverySecretResponse> {
    return this.execute(async () => ({
      success: true,
      data: {
        secret: await this.gateway.issueDeliveryOtp(context.actor.id, parseUuid(orderIdValue)),
      },
      meta: { requestId: null },
    }));
  }

  public async getCustomerTracking(
    context: AuthenticatedRequestContext,
    orderIdValue: unknown,
  ): Promise<DeliveryTrackingResponse> {
    return this.execute(async () => ({
      success: true,
      data: {
        tracking: await this.gateway.getCustomerTracking(context.actor.id, parseUuid(orderIdValue)),
      },
      meta: { requestId: null },
    }));
  }

  public async getMerchantDelivery(
    context: AuthenticatedRequestContext,
    orderIdValue: unknown,
  ): Promise<MerchantDeliveryResponse> {
    return this.execute(async () => ({
      success: true,
      data: {
        delivery: await this.gateway.getMerchantDelivery(context.actor.id, parseUuid(orderIdValue)),
      },
      meta: { requestId: null },
    }));
  }

  public async adminAssign(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.deliveryMutation('manually assigned', context, () =>
      this.gateway.adminAssign(
        parseAdminAssignInput(context.actor.id, taskId, idempotencyKey, body),
      ),
    );
  }

  public async adminRelease(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<DeliveryReleaseResponse> {
    return this.execute(async () => {
      const release = await this.gateway.adminRelease(
        parseAdminReleaseInput(context.actor.id, taskId, idempotencyKey, body),
      );
      return { success: true, data: { release }, meta: { requestId: null } };
    });
  }

  public async adminOverride(
    context: AuthenticatedRequestContext,
    taskId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<DeliveryCompletionResponse> {
    return this.execute(async () => {
      const completion = await this.gateway.adminOverride(
        parseAdminDeliveryOverrideInput(context.actor.id, taskId, idempotencyKey, body),
      );
      this.logger.warn(
        `delivery OTP override actorId=${context.actor.id} taskId=${completion.taskId} orderId=${completion.orderId} replayed=${String(completion.replayed)}`,
      );
      return { success: true, data: { completion }, meta: { requestId: null } };
    });
  }

  public async getAdminTask(
    context: AuthenticatedRequestContext,
    taskIdValue: unknown,
  ): Promise<DeliveryTrackingResponse> {
    return this.execute(async () => ({
      success: true,
      data: { tracking: await this.gateway.getAdminTask(context.actor.id, parseUuid(taskIdValue)) },
      meta: { requestId: null },
    }));
  }

  private async deliveryMutation(
    action: string,
    context: AuthenticatedRequestContext,
    operation: () => Promise<DeliveryMutationResponse['data']['delivery']>,
  ): Promise<DeliveryMutationResponse> {
    return this.execute(async () => {
      const delivery = await operation();
      this.logger.log(
        `delivery ${action} actorId=${context.actor.id} taskId=${delivery.taskId} replayed=${String(delivery.replayed)}`,
      );
      return { success: true, data: { delivery }, meta: { requestId: null } };
    });
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      return this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof DeliveryIdempotencyKeyRequiredError)
      throw createDeliveryIdempotencyRequiredException();
    if (error instanceof DeliveryValidationError || error instanceof DeliveryRequestInvalidError)
      throw createDeliveryRequestInvalidException();
    if (error instanceof DeliveryAccessDeniedError) throw createDeliveryAccessDeniedException();
    if (error instanceof CaptainNotEligibleError) throw createCaptainNotEligibleException();
    if (error instanceof DeliveryTaskNotFoundError) throw createDeliveryTaskNotFoundException();
    if (error instanceof DeliveryOfferNotFoundError) throw createDeliveryOfferNotFoundException();
    if (error instanceof DeliveryStateConflictError) throw createDeliveryStateConflictException();
    if (error instanceof DeliveryAlreadyAssignedError)
      throw createDeliveryAlreadyAssignedException();
    if (error instanceof CaptainAlreadyAssignedError) throw createCaptainAlreadyAssignedException();
    if (error instanceof DeliveryIdempotencyConflictError)
      throw createDeliveryIdempotencyConflictException();
    if (error instanceof DeliveryOfferExpiredError) throw createDeliveryOfferExpiredException();
    if (error instanceof CaptainNotAtPickupError) throw createCaptainNotAtPickupException();
    if (error instanceof PickupCodeInvalidError) throw createPickupCodeInvalidException();
    if (error instanceof DeliveryOtpInvalidError) throw createDeliveryOtpInvalidException();
    if (error instanceof DeliverySecretLockedError) throw createDeliverySecretLockedException();
    if (error instanceof CodAmountMismatchError) throw createCodAmountMismatchException();
    if (error instanceof DeliveryGatewayUnavailableError)
      throw createDeliveryUnavailableException();
    throw error;
  }
}
