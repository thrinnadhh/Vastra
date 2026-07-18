import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { ReturnEvidenceGateway } from './return-evidence.gateway';
import { ReturnEvidenceService } from './return-evidence.service';
import type {
  AssignReturnPickupInput,
  ReturnEvidenceRecord,
  ReturnEvidenceUploadIntent,
  ReturnPickupResult,
} from './return-evidence.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const RETURN_ID = '20000000-0000-4000-8000-000000000001';
const EVIDENCE_ID = '30000000-0000-4000-8000-000000000001';
const KEY = '40000000-0000-4000-8000-000000000001';
const CONTEXT = { actor: { id: ACTOR_ID } } as AuthenticatedRequestContext;

class GatewayStub implements ReturnEvidenceGateway {
  public objectKey: string | null = null;
  public createUploadIntent(
    actorId: string,
    returnId: string,
    intentId: string,
    objectKey: string,
    evidenceType: string,
    mimeType: string,
    sizeBytes: number,
  ) {
    void actorId;
    this.objectKey = objectKey;
    return Promise.resolve({
      intentId,
      returnId,
      objectKey,
      evidenceType,
      mimeType,
      sizeBytes,
      expiresAt: '2026-07-18T12:00:00.000Z',
    } as ReturnEvidenceUploadIntent);
  }
  public createSignedUploadUrl(objectKey: string) {
    void objectKey;
    return Promise.resolve('https://signed-upload.invalid');
  }
  public objectExists(objectKey: string) {
    void objectKey;
    return Promise.resolve(true);
  }
  public finalize(
    actorId: string,
    returnId: string,
    objectKey: string,
    description: string | null,
  ) {
    void actorId;
    return Promise.resolve({
      evidenceId: EVIDENCE_ID,
      returnId,
      evidenceType: 'CUSTOMER_PHOTO',
      objectKey,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      description,
      createdAt: '2026-07-18T12:00:00.000Z',
    } as ReturnEvidenceRecord);
  }
  public getOwnedObjectKey(actorId: string, returnId: string, evidenceId: string) {
    void actorId;
    void returnId;
    void evidenceId;
    return Promise.resolve(this.objectKey);
  }
  public createSignedReadUrl(objectKey: string, expiresInSeconds: number) {
    void objectKey;
    void expiresInSeconds;
    return Promise.resolve('https://signed-read.invalid');
  }
  public assignPickup(actorId: string, returnId: string, input: AssignReturnPickupInput) {
    void actorId;
    void returnId;
    void input;
    return Promise.resolve({ deliveryTaskId: EVIDENCE_ID } as ReturnPickupResult);
  }
}

describe('ReturnEvidenceService', () => {
  it('creates a customer-scoped private object key', async () => {
    const gateway = new GatewayStub();
    const service = new ReturnEvidenceService(gateway);
    const result = await service.createUploadAuthorization(CONTEXT, RETURN_ID, {
      evidenceType: 'CUSTOMER_PHOTO',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
    });
    expect(result.data.objectKey).toMatch(
      new RegExp(`^returns/${RETURN_ID}/${ACTOR_ID}/[0-9a-f-]+\\.jpg$`, 'u'),
    );
    expect(result.data.signedUploadUrl).toBe('https://signed-upload.invalid');
  });

  it('creates a short-lived read URL only for an owned evidence record', async () => {
    const gateway = new GatewayStub();
    gateway.objectKey = `returns/${RETURN_ID}/${ACTOR_ID}/${EVIDENCE_ID}.jpg`;
    const service = new ReturnEvidenceService(gateway);
    const result = await service.createReadAuthorization(CONTEXT, RETURN_ID, EVIDENCE_ID);
    expect(result.data.expiresInSeconds).toBe(300);
    expect(result.data.signedReadUrl).toBe('https://signed-read.invalid');
  });

  it('builds an idempotent pickup command with the frozen reason code', async () => {
    const service = new ReturnEvidenceService(new GatewayStub());
    const result = await service.assignPickup(CONTEXT, RETURN_ID, KEY, {
      reasonCode: 'RETURN_LOGISTICS',
      scheduledAt: '2026-07-19T08:00:00.000Z',
    });
    expect(result.data).toEqual({ deliveryTaskId: EVIDENCE_ID });
  });
});
