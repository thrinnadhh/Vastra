import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import { RETURN_EVIDENCE_GATEWAY } from './customer-return.tokens';
import {
  type ReturnEvidenceGateway,
  ReturnEvidenceGatewayUnavailableError,
  ReturnEvidenceNotFoundError,
  ReturnEvidenceStateConflictError,
  ReturnPickupIdempotencyConflictError,
} from './return-evidence.gateway';
import type {
  ReturnEvidenceReadAuthorization,
  ReturnEvidenceRecord,
  ReturnEvidenceUploadAuthorization,
  ReturnLogisticsResponse,
  ReturnPickupResult,
} from './return-evidence.types';
import {
  ReturnEvidenceValidationError,
  ReturnPickupIdempotencyKeyRequiredError,
  parseAssignReturnPickupInput,
  parseCreateReturnEvidenceUploadInput,
  parseFinalizeReturnEvidenceInput,
  requireReturnLogisticsUuid,
} from './return-evidence.validation';

const READ_URL_TTL_SECONDS = 300;

function extensionForMimeType(mimeType: string): string {
  const extensions: Readonly<Record<string, string>> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'application/pdf': 'pdf',
  };
  const extension = extensions[mimeType];
  if (extension === undefined) throw new ReturnEvidenceValidationError();
  return extension;
}

@Injectable()
export class ReturnEvidenceService {
  public constructor(
    @Inject(RETURN_EVIDENCE_GATEWAY)
    private readonly gateway: ReturnEvidenceGateway,
  ) {}

  public async createUploadAuthorization(
    context: AuthenticatedRequestContext,
    rawReturnId: unknown,
    body: unknown,
  ): Promise<ReturnLogisticsResponse<ReturnEvidenceUploadAuthorization>> {
    try {
      const returnId = requireReturnLogisticsUuid(rawReturnId);
      const input = parseCreateReturnEvidenceUploadInput(body);
      const intentId = randomUUID();
      const objectKey = `returns/${returnId}/${context.actor.id}/${intentId}.${extensionForMimeType(input.mimeType)}`;
      const intent = await this.gateway.createUploadIntent(
        context.actor.id,
        returnId,
        intentId,
        objectKey,
        input.evidenceType,
        input.mimeType,
        input.sizeBytes,
      );
      const signedUploadUrl = await this.gateway.createSignedUploadUrl(objectKey);
      return this.success({ ...intent, signedUploadUrl });
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async finalize(
    context: AuthenticatedRequestContext,
    rawReturnId: unknown,
    body: unknown,
  ): Promise<ReturnLogisticsResponse<ReturnEvidenceRecord>> {
    try {
      const returnId = requireReturnLogisticsUuid(rawReturnId);
      const input = parseFinalizeReturnEvidenceInput(body);
      if (!input.objectKey.startsWith(`returns/${returnId}/${context.actor.id}/`)) {
        throw new ReturnEvidenceValidationError();
      }
      if (!(await this.gateway.objectExists(input.objectKey))) {
        throw new ReturnEvidenceNotFoundError();
      }
      return this.success(
        await this.gateway.finalize(
          context.actor.id,
          returnId,
          input.objectKey,
          input.description,
        ),
      );
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async createReadAuthorization(
    context: AuthenticatedRequestContext,
    rawReturnId: unknown,
    rawEvidenceId: unknown,
  ): Promise<ReturnLogisticsResponse<ReturnEvidenceReadAuthorization>> {
    try {
      const returnId = requireReturnLogisticsUuid(rawReturnId);
      const evidenceId = requireReturnLogisticsUuid(rawEvidenceId);
      const objectKey = await this.gateway.getOwnedObjectKey(
        context.actor.id,
        returnId,
        evidenceId,
      );
      if (objectKey === null) throw new ReturnEvidenceNotFoundError();
      const signedReadUrl = await this.gateway.createSignedReadUrl(
        objectKey,
        READ_URL_TTL_SECONDS,
      );
      return this.success({ evidenceId, objectKey, signedReadUrl, expiresInSeconds: READ_URL_TTL_SECONDS });
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  public async assignPickup(
    context: AuthenticatedRequestContext,
    rawReturnId: unknown,
    idempotencyKey: unknown,
    body: unknown,
  ): Promise<ReturnLogisticsResponse<ReturnPickupResult>> {
    try {
      const result = await this.gateway.assignPickup(
        context.actor.id,
        requireReturnLogisticsUuid(rawReturnId),
        parseAssignReturnPickupInput(body, idempotencyKey),
      );
      return this.success(result);
    } catch (error: unknown) {
      return this.rethrowMapped(error);
    }
  }

  private success<T>(data: T): ReturnLogisticsResponse<T> {
    return { success: true, data, meta: { requestId: null } };
  }

  private rethrowMapped(error: unknown): never {
    if (
      error instanceof ReturnEvidenceValidationError ||
      error instanceof ReturnPickupIdempotencyKeyRequiredError
    ) {
      throw new BadRequestException('Return logistics request is invalid');
    }
    if (
      error instanceof ReturnEvidenceStateConflictError ||
      error instanceof ReturnPickupIdempotencyConflictError
    ) {
      throw new ConflictException('Return logistics conflicts with current state');
    }
    if (error instanceof ReturnEvidenceNotFoundError) {
      throw new NotFoundException('Return evidence was not found');
    }
    if (error instanceof ReturnEvidenceGatewayUnavailableError) {
      throw new ServiceUnavailableException('Return logistics service is unavailable');
    }
    throw error;
  }
}
