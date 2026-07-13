import {
  Body,
  Controller,
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
import { CustomerInventoryReservationService } from './customer-inventory-reservation.service';
import type { CustomerInventoryReservationResponse } from './customer-inventory-reservation.types';

@Controller('customer/inventory/reservations')
@AllowAccountTypes('CUSTOMER')
@RequireOperationalReadiness()
export class CustomerInventoryReservationController {
  public constructor(
    @Inject(CustomerInventoryReservationService)
    private readonly reservationService: CustomerInventoryReservationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  public createReservation(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Headers('idempotency-key') idempotencyKey: unknown,
    @Body() body: unknown,
  ): Promise<CustomerInventoryReservationResponse> {
    return this.reservationService.createReservation(context, idempotencyKey, body);
  }

  @Post(':reservationId/release')
  @HttpCode(HttpStatus.OK)
  public releaseReservation(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
    @Param('reservationId') reservationId: unknown,
    @Body() body: unknown,
  ): Promise<CustomerInventoryReservationResponse> {
    return this.reservationService.releaseReservation(context, reservationId, body);
  }
}
