import { Module } from '@nestjs/common';

import { MeController } from './me.controller';
import { SupabaseMeGateway } from './me.gateway';
import { MeService } from './me.service';
import { ME_GATEWAY } from './me.tokens';

@Module({
  controllers: [MeController],
  providers: [
    MeService,
    {
      provide: ME_GATEWAY,
      useClass: SupabaseMeGateway,
    },
  ],
})
export class MeModule {}
