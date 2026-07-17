import { describe, expect, it } from 'vitest';

import {
  DeliveryIdempotencyKeyRequiredError,
  DeliveryValidationError,
  parseAdminAssignInput,
  parseAdminDeliveryOverrideInput,
  parseArrivePickupInput,
  parseCompleteDeliveryInput,
  parseIdempotencyKey,
  parseLifecycleLocationInput,
  parseProblemInput,
  parseRejectOfferInput,
  parseReleaseInput,
  parseUuid,
  parseVerifyPickupInput,
} from './delivery.validation';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const TASK_ID = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';
const CAPTAIN_ID = '40000000-0000-4000-8000-000000000001';
const LOCATION = {
  latitude: 13.6288,
  longitude: 79.4192,
  accuracyMeters: 12,
  recordedAt: '2026-07-17T10:00:00.000Z',
};

describe('delivery validation', () => {
  it('accepts frozen identifiers and offer rejection reasons', () => {
    expect(parseUuid(TASK_ID)).toBe(TASK_ID);
    expect(parseIdempotencyKey(KEY)).toBe(KEY);
    expect(parseRejectOfferInput(TASK_ID, KEY, { reason: 'TOO_FAR' })).toStrictEqual({
      assignmentId: TASK_ID,
      idempotencyKey: KEY,
      reason: 'TOO_FAR',
    });
  });

  it('rejects missing and malformed idempotency keys', () => {
    expect(() => parseIdempotencyKey(undefined)).toThrow(DeliveryIdempotencyKeyRequiredError);
    expect(() => parseIdempotencyKey('bad')).toThrow(DeliveryValidationError);
  });

  it('parses arrival location from the frozen nested shape', () => {
    expect(parseArrivePickupInput(ACTOR_ID, TASK_ID, KEY, { location: LOCATION })).toStrictEqual({
      actorId: ACTOR_ID,
      taskId: TASK_ID,
      idempotencyKey: KEY,
      ...LOCATION,
    });

    expect(() =>
      parseArrivePickupInput(ACTOR_ID, TASK_ID, KEY, {
        location: LOCATION,
        skipProximity: true,
      }),
    ).toThrow(DeliveryValidationError);
  });

  it('validates pickup and delivery secrets without logging or normalising them', () => {
    expect(parseVerifyPickupInput(ACTOR_ID, TASK_ID, KEY, { pickupCode: '123456' })).toStrictEqual({
      actorId: ACTOR_ID,
      taskId: TASK_ID,
      idempotencyKey: KEY,
      pickupCode: '123456',
    });
    expect(() => parseVerifyPickupInput(ACTOR_ID, TASK_ID, KEY, { pickupCode: '12345' })).toThrow(
      DeliveryValidationError,
    );

    expect(
      parseCompleteDeliveryInput(ACTOR_ID, TASK_ID, KEY, {
        collectedAmountPaise: 149900,
        deliveryOtp: '654321',
        location: LOCATION,
      }),
    ).toMatchObject({ collectedAmountPaise: 149900, deliveryOtp: '654321', location: LOCATION });
  });

  it('allows optional lifecycle locations and rejects invalid coordinates', () => {
    expect(parseLifecycleLocationInput(ACTOR_ID, TASK_ID, KEY, {})).toMatchObject({
      location: null,
    });
    expect(() =>
      parseLifecycleLocationInput(ACTOR_ID, TASK_ID, KEY, {
        location: { ...LOCATION, latitude: 100 },
      }),
    ).toThrow(DeliveryValidationError);
  });

  it('parses problem and pre-pickup release commands', () => {
    expect(
      parseProblemInput(ACTOR_ID, TASK_ID, KEY, {
        reason: 'CUSTOMER_UNAVAILABLE',
        note: 'Customer did not answer.',
      }),
    ).toMatchObject({ reason: 'CUSTOMER_UNAVAILABLE', note: 'Customer did not answer.' });

    expect(
      parseReleaseInput(ACTOR_ID, TASK_ID, KEY, {
        reason: 'VEHICLE_ISSUE',
        note: 'Tyre puncture.',
      }),
    ).toMatchObject({ reason: 'VEHICLE_ISSUE', note: 'Tyre puncture.' });
  });

  it('requires a concrete audited reason for an admin OTP override', () => {
    expect(
      parseAdminDeliveryOverrideInput(ACTOR_ID, TASK_ID, KEY, {
        collectedAmountPaise: 149900,
        reason: 'Customer phone was unavailable; identity checked by operations.',
      }),
    ).toMatchObject({ collectedAmountPaise: 149900 });
    expect(() =>
      parseAdminDeliveryOverrideInput(ACTOR_ID, TASK_ID, KEY, {
        collectedAmountPaise: 149900,
        reason: 'override',
      }),
    ).toThrow(DeliveryValidationError);
  });

  it('parses manual assignment and rejects invalid captain ids', () => {
    expect(parseAdminAssignInput(ACTOR_ID, TASK_ID, KEY, { captainId: CAPTAIN_ID })).toStrictEqual({
      actorId: ACTOR_ID,
      taskId: TASK_ID,
      idempotencyKey: KEY,
      captainId: CAPTAIN_ID,
    });
    expect(() => parseAdminAssignInput(ACTOR_ID, TASK_ID, KEY, { captainId: 'bad' })).toThrow(
      DeliveryValidationError,
    );
  });
});
