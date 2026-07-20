import { describe, expect, it } from 'vitest';

import {
  MutationIntentController,
  MutationIntentConflictError,
  asIdempotencyKey,
  createIdempotencyKey,
} from '../src/index';

const FIRST_KEY = '10000000-0000-4000-8000-000000000001';
const SECOND_KEY = '20000000-0000-4000-8000-000000000002';

describe('mutation intent and idempotency lifecycle', () => {
  it('reuses one stable key for the same unresolved intent and unknown outcome', () => {
    const controller = new MutationIntentController(() => asIdempotencyKey(FIRST_KEY));

    expect(controller.begin('place-order:quote-1')).toBe(FIRST_KEY);
    controller.markUnknownOutcome('place-order:quote-1');
    expect(controller.begin('place-order:quote-1')).toBe(FIRST_KEY);
    expect(controller.current()).toEqual({ intentId: 'place-order:quote-1', idempotencyKey: FIRST_KEY });
  });

  it('clears only for terminal success, rejection, cancel, or replacement', () => {
    const keys = [FIRST_KEY, SECOND_KEY];
    const controller = new MutationIntentController(() =>
      asIdempotencyKey(keys.shift() ?? SECOND_KEY),
    );

    expect(controller.begin('intent-1')).toBe(FIRST_KEY);
    controller.clear('SUCCESS');
    expect(controller.begin('intent-2')).toBe(SECOND_KEY);
    controller.clear('REJECTED');
    expect(controller.current()).toBeNull();
    controller.begin('intent-3');
    controller.clear('CANCELLED');
    controller.begin('intent-4');
    controller.clear('AUTHORITATIVE_REPLACEMENT');
    expect(controller.current()).toBeNull();
  });

  it('serializes commands by refusing a different intent while one is unresolved', () => {
    const controller = new MutationIntentController(() => asIdempotencyKey(FIRST_KEY));
    controller.begin('accept-order:1');

    expect(() => controller.begin('reject-order:1')).toThrow(MutationIntentConflictError);
  });

  it('validates generated idempotency keys without persisting or exposing intent variables', () => {
    expect(createIdempotencyKey(() => FIRST_KEY)).toBe(FIRST_KEY);
    expect(() => createIdempotencyKey(() => 'not-a-uuid')).toThrow(
      'Idempotency keys must be UUIDs',
    );
  });
});
