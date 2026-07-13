import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthenticationGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { SupabaseAuthorizationGateway } from './authorization.gateway';
import { AuthorizationGuard } from './authorization.guard';
import { AuthorizationService } from './authorization.service';
import { AUTHORIZATION_GATEWAY } from './authorization.tokens';
import { createSupabaseServiceClient, SupabaseAuthenticationGateway } from './supabase.gateway';
import { loadSupabaseConfiguration, SUPABASE_CONFIGURATION } from './supabase.configuration';
import { AUTHENTICATION_GATEWAY, SUPABASE_SERVICE_CLIENT } from './supabase.tokens';

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CONFIGURATION,
      useFactory: loadSupabaseConfiguration,
    },
    {
      provide: SUPABASE_SERVICE_CLIENT,
      inject: [SUPABASE_CONFIGURATION],
      useFactory: createSupabaseServiceClient,
    },
    {
      provide: AUTHENTICATION_GATEWAY,
      useClass: SupabaseAuthenticationGateway,
    },
    {
      provide: AUTHORIZATION_GATEWAY,
      useClass: SupabaseAuthorizationGateway,
    },
    AuthService,
    AuthorizationService,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizationGuard,
    },
  ],
  exports: [
    AuthService,
    AuthorizationService,
    AUTHENTICATION_GATEWAY,
    AUTHORIZATION_GATEWAY,
    SUPABASE_SERVICE_CLIENT,
  ],
})
export class AuthModule {}
