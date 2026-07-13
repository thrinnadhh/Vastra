import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthenticationGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { SupabaseAuthorizationGateway } from './authorization.gateway';
import { AuthorizationGuard } from './authorization.guard';
import { AuthorizationService } from './authorization.service';
import { AUTHORIZATION_GATEWAY } from './authorization.tokens';
import { SupabaseOperationalReadinessGateway } from './operational-readiness.gateway';
import { OperationalReadinessGuard } from './operational-readiness.guard';
import { OperationalReadinessService } from './operational-readiness.service';
import { OPERATIONAL_READINESS_GATEWAY } from './operational-readiness.tokens';
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
    {
      provide: OPERATIONAL_READINESS_GATEWAY,
      useClass: SupabaseOperationalReadinessGateway,
    },
    AuthService,
    AuthorizationService,
    OperationalReadinessService,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthorizationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OperationalReadinessGuard,
    },
  ],
  exports: [
    AuthService,
    AuthorizationService,
    OperationalReadinessService,
    AUTHENTICATION_GATEWAY,
    AUTHORIZATION_GATEWAY,
    OPERATIONAL_READINESS_GATEWAY,
    SUPABASE_SERVICE_CLIENT,
  ],
})
export class AuthModule {}
