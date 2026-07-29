import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  AdminCityAccessDeniedError,
  type AdminCityGateway,
  AdminCityGatewayUnavailableError,
  AdminCityIdempotencyConflictError,
  AdminCityInputRejectedError,
  AdminCityNotFoundError,
  AdminCityPreflightRequiredError,
  AdminCityStateConflictError,
  AdminCityVersionConflictError,
} from './admin-city.gateway';
import type {
  AdminCityControlPlane,
  AdminCityMutationResult,
  AdminCityPreflightResult,
  AdminMutationMetadata,
} from './admin-city.types';
import { ADMIN_CITY_GATEWAY } from './admin.tokens';
import { ADMIN_MUTATION_REASON_CODES, type AdminMutationReasonCode } from './admin.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/u;
const CONFIGURATION_KEYS = new Set([
  'timezone',
  'defaultCodLimitPaise',
  'defaultDeliveryRadiusMeters',
  'maximumDeliveryRadiusMeters',
  'baseDeliveryFeePaise',
  'perKmDeliveryFeePaise',
  'merchantCommissionBps',
  'localDeliveryEnabled',
  'postalDeliveryEnabled',
  'operatingHours',
  'holidayDates',
  'cancellationPolicy',
  'refundPolicy',
]);

function invalid(message: string): never {
  throw new BadRequestException({
    success: false,
    error: { code: 'VALIDATION_ERROR', message, details: null, retryable: false },
    requestId: null,
  });
}

function requireRecord(value: unknown, message = 'The request body is invalid.') {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(message);
  return value as Record<string, unknown>;
}

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value.trim())) {
    invalid(`${field} must be a UUID.`);
  }
  return value.trim();
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  return requireUuid(value, field);
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    invalid(`${field} must be a positive integer.`);
  }
  return value;
}

function optionalPositiveInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  return requirePositiveInteger(value, field);
}

function parseMetadata(
  context: AuthenticatedRequestContext,
  cityIdValue: unknown,
  idempotencyKeyValue: unknown,
  requestId: string | null,
  body: Record<string, unknown>,
): AdminMutationMetadata {
  const reasonCode = body['reasonCode'];
  if (
    typeof reasonCode !== 'string' ||
    !ADMIN_MUTATION_REASON_CODES.includes(reasonCode as AdminMutationReasonCode)
  ) {
    invalid('reasonCode is invalid.');
  }
  const rawNote = body['note'];
  let note: string | null = null;
  if (rawNote !== undefined && rawNote !== null) {
    if (typeof rawNote !== 'string') invalid('note must be a string.');
    note = rawNote.trim();
    if (note.length === 0 || note.length > 1000) invalid('note must contain 1–1000 characters.');
  }
  return {
    actorId: context.actor.id,
    cityId: requireUuid(cityIdValue, 'cityId'),
    reasonCode: reasonCode as AdminMutationReasonCode,
    note,
    requestId,
    idempotencyKey: requireUuid(idempotencyKeyValue, 'idempotency-key'),
  };
}

@Injectable()
export class AdminCityService {
  public constructor(
    @Inject(ADMIN_CITY_GATEWAY)
    private readonly gateway: AdminCityGateway,
  ) {}

  public list(context: AuthenticatedRequestContext): Promise<readonly AdminCityControlPlane[]> {
    return this.execute(() => this.gateway.list(context.actor.id));
  }

  public get(
    context: AuthenticatedRequestContext,
    cityId: unknown,
  ): Promise<AdminCityControlPlane> {
    return this.execute(() => this.gateway.get(context.actor.id, requireUuid(cityId, 'cityId')));
  }

  public updateConfiguration(
    context: AuthenticatedRequestContext,
    cityId: unknown,
    idempotencyKey: unknown,
    requestId: string | null,
    bodyValue: unknown,
  ): Promise<AdminCityMutationResult> {
    const body = requireRecord(bodyValue);
    const patch = requireRecord(body['patch'], 'patch must be an object.');
    if (
      Object.keys(patch).length === 0 ||
      Object.keys(patch).some((key) => !CONFIGURATION_KEYS.has(key))
    ) {
      invalid('patch contains no supported city configuration fields.');
    }
    return this.execute(() =>
      this.gateway.updateConfiguration({
        ...parseMetadata(context, cityId, idempotencyKey, requestId, body),
        expectedVersion: requirePositiveInteger(body['expectedVersion'], 'expectedVersion'),
        patch,
      }),
    );
  }

  public upsertZone(
    context: AuthenticatedRequestContext,
    cityId: unknown,
    zoneId: unknown,
    idempotencyKey: unknown,
    requestId: string | null,
    bodyValue: unknown,
  ): Promise<AdminCityMutationResult> {
    const body = requireRecord(bodyValue);
    const patch = requireRecord(body['patch'], 'patch must be an object.');
    if (Object.keys(patch).length === 0) invalid('patch cannot be empty.');
    return this.execute(() =>
      this.gateway.upsertZone({
        ...parseMetadata(context, cityId, idempotencyKey, requestId, body),
        zoneId: optionalUuid(zoneId, 'zoneId'),
        expectedVersion: optionalPositiveInteger(body['expectedVersion'], 'expectedVersion'),
        patch,
      }),
    );
  }

  public upsertPincode(
    context: AuthenticatedRequestContext,
    cityId: unknown,
    zoneId: unknown,
    mappingId: unknown,
    idempotencyKey: unknown,
    requestId: string | null,
    bodyValue: unknown,
  ): Promise<AdminCityMutationResult> {
    const body = requireRecord(bodyValue);
    const pincode = body['pincode'];
    if (typeof pincode !== 'string' || !PINCODE_PATTERN.test(pincode)) {
      invalid('pincode must be a valid six-digit Indian pincode.');
    }
    const isPrimary = body['isPrimary'];
    const isActive = body['isActive'];
    if (typeof isPrimary !== 'boolean' || typeof isActive !== 'boolean') {
      invalid('isPrimary and isActive must be booleans.');
    }
    return this.execute(() =>
      this.gateway.upsertPincode({
        ...parseMetadata(context, cityId, idempotencyKey, requestId, body),
        zoneId: requireUuid(zoneId, 'zoneId'),
        mappingId: optionalUuid(mappingId, 'mappingId'),
        expectedVersion: optionalPositiveInteger(body['expectedVersion'], 'expectedVersion'),
        pincode,
        priority: requirePositiveInteger(body['priority'], 'priority'),
        isPrimary,
        isActive,
      }),
    );
  }

  public updateReadiness(
    context: AuthenticatedRequestContext,
    cityId: unknown,
    idempotencyKey: unknown,
    requestId: string | null,
    bodyValue: unknown,
  ): Promise<AdminCityMutationResult> {
    const body = requireRecord(bodyValue);
    const readiness = requireRecord(body['readiness'], 'readiness must be an object.');
    if (Object.keys(readiness).length === 0) invalid('readiness cannot be empty.');
    return this.execute(() =>
      this.gateway.updateReadiness({
        ...parseMetadata(context, cityId, idempotencyKey, requestId, body),
        expectedVersion: requirePositiveInteger(body['expectedVersion'], 'expectedVersion'),
        readiness,
      }),
    );
  }

  public runPreflight(
    context: AuthenticatedRequestContext,
    cityId: unknown,
    idempotencyKey: unknown,
    requestId: string | null,
    bodyValue: unknown,
  ): Promise<AdminCityPreflightResult> {
    const body = requireRecord(bodyValue);
    return this.execute(() =>
      this.gateway.runPreflight(parseMetadata(context, cityId, idempotencyKey, requestId, body)),
    );
  }

  public transition(
    context: AuthenticatedRequestContext,
    cityId: unknown,
    idempotencyKey: unknown,
    requestId: string | null,
    bodyValue: unknown,
    targetStatus: 'ACTIVE' | 'PAUSED',
  ): Promise<AdminCityMutationResult> {
    const body = requireRecord(bodyValue);
    return this.execute(() =>
      this.gateway.transition({
        ...parseMetadata(context, cityId, idempotencyKey, requestId, body),
        targetStatus,
      }),
    );
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof AdminCityNotFoundError) throw new NotFoundException('City not found.');
      if (error instanceof AdminCityAccessDeniedError) {
        throw new ForbiddenException('The administrator is not authorised for this city action.');
      }
      if (error instanceof AdminCityVersionConflictError) {
        throw new ConflictException(
          'The city resource changed. Refresh and retry with its latest version.',
        );
      }
      if (error instanceof AdminCityPreflightRequiredError) {
        throw new ConflictException('A fresh passing activation preflight is required.');
      }
      if (error instanceof AdminCityStateConflictError) {
        throw new ConflictException('The requested city lifecycle transition is not allowed.');
      }
      if (error instanceof AdminCityIdempotencyConflictError) {
        throw new ConflictException('The idempotency key was already used with different input.');
      }
      if (error instanceof AdminCityInputRejectedError) {
        invalid('The city command was rejected by the authoritative database contract.');
      }
      if (error instanceof AdminCityGatewayUnavailableError) {
        throw new ServiceUnavailableException('The city control plane is temporarily unavailable.');
      }
      throw error;
    }
  }
}
