import { describe, expect, it } from 'vitest';

import {
  CaptainPresenceValidationError,
  parseCaptainAvailabilityBody,
  parseCaptainLocationBody,
} from './captain-presence.validation';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const SAMPLE_ID = '20000000-0000-4000-8000-000000000001';

function validLocation(): Record<string, unknown> {
  return {
    sampleId: SAMPLE_ID,
    latitude: 13.6288,
    longitude: 79.4192,
    accuracyMeters: 12,
    recordedAt: '2026-07-17T10:00:00.000Z',
    heading: 45,
    speedMps: 3.5,
    batteryPercent: 80,
    activeDeliveryTaskId: null,
  };
}

describe('captain presence validation', () => {
  it('accepts only client-controlled availability states', () => {
    expect(parseCaptainAvailabilityBody({ status: 'AVAILABLE' })).toBe('AVAILABLE');
    expect(() => parseCaptainAvailabilityBody({ status: 'ASSIGNED' })).toThrow(
      CaptainPresenceValidationError,
    );
    expect(() => parseCaptainAvailabilityBody({ status: 'OFFLINE', extra: true })).toThrow(
      CaptainPresenceValidationError,
    );
  });

  it('parses a bounded location sample', () => {
    expect(parseCaptainLocationBody(ACTOR_ID, validLocation())).toEqual({
      actorId: ACTOR_ID,
      sampleId: SAMPLE_ID,
      latitude: 13.6288,
      longitude: 79.4192,
      accuracyMeters: 12,
      recordedAt: '2026-07-17T10:00:00.000Z',
      heading: 45,
      speedMps: 3.5,
      batteryPercent: 80,
      activeDeliveryTaskId: null,
    });
  });

  it('rejects invalid coordinates and sensor metadata', () => {
    expect(() =>
      parseCaptainLocationBody(ACTOR_ID, { ...validLocation(), latitude: 91 }),
    ).toThrow(CaptainPresenceValidationError);
    expect(() =>
      parseCaptainLocationBody(ACTOR_ID, { ...validLocation(), accuracyMeters: -1 }),
    ).toThrow(CaptainPresenceValidationError);
    expect(() =>
      parseCaptainLocationBody(ACTOR_ID, { ...validLocation(), batteryPercent: 101 }),
    ).toThrow(CaptainPresenceValidationError);
  });
});
