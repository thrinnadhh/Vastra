import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminCaseGateway } from './admin-case.gateway';
import type {
  AdminAddCaseNoteInput,
  AdminAssignCaseInput,
  AdminCaseListInput,
  AdminCaseMutationContext,
  AdminCaseSnapshot,
  AdminCreateCaseInput,
  AdminResolveCaseInput,
} from './admin-case.types';
import {
  AdminCaseIdempotencyKeyRequiredError,
  AdminCaseRequestInvalidError,
  AdminCaseService,
} from './admin-case.service';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const CASE_ID = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';
const CONTEXT = { actor: { id: ACTOR_ID } } as AuthenticatedRequestContext;

class GatewayStub implements AdminCaseGateway {
  public input: unknown = null;
  public list(input: AdminCaseListInput) {
    this.input = input;
    return Promise.resolve([]);
  }
  public get() {
    return Promise.resolve({ case: { id: CASE_ID } } as AdminCaseSnapshot);
  }
  public create(input: AdminCreateCaseInput) {
    return this.capture(input);
  }
  public assign(input: AdminAssignCaseInput) {
    return this.capture(input);
  }
  public addNote(input: AdminAddCaseNoteInput) {
    return this.capture(input);
  }
  public escalate(input: AdminCaseMutationContext) {
    return this.capture(input);
  }
  public resolve(input: AdminResolveCaseInput) {
    return this.capture(input);
  }
  public close(input: AdminCaseMutationContext) {
    return this.capture(input);
  }
  private capture(input: unknown) {
    this.input = input;
    return Promise.resolve({ case: { id: CASE_ID } } as AdminCaseSnapshot);
  }
}

describe('AdminCaseService', () => {
  it('creates an actor-bound classified incident', async () => {
    const gateway = new GatewayStub();
    const service = new AdminCaseService(gateway);
    await service.create(CONTEXT, KEY, 'request-1', {
      category: 'DELIVERY_INCIDENT',
      priority: 'HIGH',
      subject: 'Package damaged',
      description: 'Customer reported visible damage.',
      reasonCode: 'DELIVERY_FAILURE',
      deliveryTaskId: CASE_ID,
    });
    expect(gateway.input).toMatchObject({
      actorId: ACTOR_ID,
      category: 'DELIVERY_INCIDENT',
      priority: 'HIGH',
      idempotencyKey: KEY,
    });
  });

  it('requires idempotency for case mutations', async () => {
    const service = new AdminCaseService(new GatewayStub());
    await expect(
      service.escalate(CONTEXT, CASE_ID, undefined, null, {
        reasonCode: 'SAFETY_INCIDENT',
      }),
    ).rejects.toBeInstanceOf(AdminCaseIdempotencyKeyRequiredError);
  });

  it('rejects unsupported classifications', () => {
    const service = new AdminCaseService(new GatewayStub());
    expect(() =>
      service.create(CONTEXT, KEY, null, {
        category: 'RAW_DATABASE_EDIT',
        priority: 'HIGH',
        subject: 'Bad category',
        description: 'Invalid',
        reasonCode: 'OTHER',
      }),
    ).toThrow(AdminCaseRequestInvalidError);
  });
});
