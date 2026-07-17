import { Controller, Get, Header, Inject, Param } from '@nestjs/common';

import { AllowAccountTypes } from '../auth/account-types.decorator';
import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { RequireOperationalReadiness } from '../auth/operational-readiness.decorator';
import { DeliveryService } from './delivery.service';
import type {
  DeliverySecretResponse,
  DeliveryTrackingResponse,
  MerchantDeliveryResponse,
} from './delivery.types';

@Controller('merchant/orders')
@AllowAccountTypes('MERCHANT')
@RequireOperationalReadiness()
export class MerchantDeliveryController {
  public constructor(@Inject(DeliveryService) private readonly service: DeliveryService) {}

  @Get(':orderId/pickup-code')
  @Header('Cache-Control', 'no-store')
  public issuePickupCode(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
  ): Promise<DeliverySecretResponse> {
    return this.service.issuePickupCode(context, orderId);
  }

  @Get(':orderId/delivery')
  public getDelivery(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
  ): Promise<MerchantDeliveryResponse> {
    return this.service.getMerchantDelivery(context, orderId);
  }
}

@Controller('customer/orders')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerDeliveryController {
  public constructor(@Inject(DeliveryService) private readonly service: DeliveryService) {}

  @Get(':orderId/tracking')
  @Header('Cache-Control', 'no-store')
  public getTracking(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
  ): Promise<DeliveryTrackingResponse> {
    return this.service.getCustomerTracking(context, orderId);
  }

  @Get(':orderId/delivery-otp')
  @Header('Cache-Control', 'no-store')
  public issueDeliveryOtp(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('orderId') orderId: unknown,
  ): Promise<DeliverySecretResponse> {
    return this.service.issueDeliveryOtp(context, orderId);
  }
}
