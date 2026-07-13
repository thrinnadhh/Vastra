import { Controller, Get, Inject } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { CurrentAuthContext } from '../auth/current-auth-context.decorator';
import { MeService } from './me.service';
import type { GetCurrentAccountResponse } from './me.types';

@Controller('me')
export class MeController {
  public constructor(@Inject(MeService) private readonly meService: MeService) {}

  @Get()
  public getCurrentAccount(
    @CurrentAuthContext() context: AuthenticatedRequestContext,
  ): Promise<GetCurrentAccountResponse> {
    return this.meService.getCurrentAccount(context);
  }
}
