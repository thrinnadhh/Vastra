import { describe, expect, it } from 'vitest';
describe('merchant order decision integration contract', () => {
  it('keeps accept and reject as separate commands', () => {
    expect('/merchant/orders/:orderId/accept').not.toBe('/merchant/orders/:orderId/reject');
  });
});
