import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { DeliveryService } from './delivery.service';
import type {
  CaptainDeliveryResponse,
  DeliveryCompletionResponse,
  DeliveryMutationResponse,
  DeliveryOffersResponse,
  DeliveryProblemResponse,
  DeliveryRejectionResponse,
  DeliveryReleaseResponse,
} from './delivery.types';

@Controller('captain')
@AllowAccountTypes('CAPTAIN')
@RequireOperationalReadiness()
export class DeliveryController {
  public constructor(@Inject(DeliveryService) private readonly service: DeliveryService) {}

  @Get('delivery-offers')
  public listOffers(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<DeliveryOffersResponse> {
    return this.service.listOffers(context);
  }

  @Post('delivery-offers/:assignmentId/accept')
  @HttpCode(HttpStatus.OK)
  public acceptOffer(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('assignmentId') assignmentId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.service.acceptOffer(context, assignmentId, idempotencyKey);
  }

  @Post('delivery-offers/:assignmentId/reject')
  @HttpCode(HttpStatus.OK)
  public rejectOffer(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('assignmentId') assignmentId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<DeliveryRejectionResponse> {
    return this.service.rejectOffer(context, assignmentId, idempotencyKey, body);
  }

  @Get('deliveries/active')
  public getActive(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<CaptainDeliveryResponse> {
    return this.service.getActive(context);
  }

  @Get('deliveries/:taskId')
  public getTask(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
  ): Promise<CaptainDeliveryResponse> {
    return this.service.getTask(context, taskId);
  }

  @Post('deliveries/:taskId/arrive-pickup')
  @HttpCode(HttpStatus.OK)
  public arrivePickup(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.service.arrivePickup(context, taskId, idempotencyKey, body);
  }

  @Post('deliveries/:taskId/verify-pickup')
  @HttpCode(HttpStatus.OK)
  public verifyPickup(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.service.verifyPickup(context, taskId, idempotencyKey, body);
  }

  @Post('deliveries/:taskId/depart-pickup')
  @HttpCode(HttpStatus.OK)
  public departPickup(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.service.departPickup(context, taskId, idempotencyKey, body);
  }

  @Post('deliveries/:taskId/arrive-drop')
  @HttpCode(HttpStatus.OK)
  public arriveDrop(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<DeliveryMutationResponse> {
    return this.service.arriveDrop(context, taskId, idempotencyKey, body);
  }

  @Post('deliveries/:taskId/complete')
  @HttpCode(HttpStatus.OK)
  public complete(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<DeliveryCompletionResponse> {
    return this.service.complete(context, taskId, idempotencyKey, body);
  }

  @Post('deliveries/:taskId/report-problem')
  @HttpCode(HttpStatus.OK)
  public reportProblem(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<DeliveryProblemResponse> {
    return this.service.reportProblem(context, taskId, idempotencyKey, body);
  }

  @Post('deliveries/:taskId/release')
  @HttpCode(HttpStatus.OK)
  public release(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('taskId') taskId: unknown,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<DeliveryReleaseResponse> {
    return this.service.release(context, taskId, idempotencyKey, body);
  }
}
