import { describe, expect, it } from 'vitest';

import {
  canTransitionPayment,
  canTransitionRefund,
  canTransitionReturn,
  formatPaiseForProvider,
  parseProviderAmountToPaise,
} from './finance.contracts';

describe('Sprint 10 finance closure contracts', () => {
  it('preserves authoritative payment and refund terminal states', () => {
    expect(canTransitionPayment('CAPTURED', 'REFUNDED')).toBe(true);
    expect(canTransitionPayment('REFUNDED', 'CAPTURED')).toBe(false);
    expect(canTransitionRefund('FAILED', 'INITIATED')).toBe(true);
    expect(canTransitionRefund('COMPLETED', 'PROCESSING')).toBe(false);
  });

  it('preserves the return decision and refund lifecycle', () => {
    expect(canTransitionReturn('REQUESTED', 'REVIEW')).toBe(true);
    expect(canTransitionReturn('REVIEW', 'APPROVED')).toBe(true);
    expect(canTransitionReturn('RECEIVED', 'REVIEW')).toBe(true);
    expect(canTransitionReturn('VERIFIED', 'REFUND_PENDING')).toBe(true);
    expect(canTransitionReturn('REFUND_PENDING', 'REFUNDED')).toBe(true);
  });

  it('round-trips integer paise at the provider boundary', () => {
    expect(formatPaiseForProvider(12501)).toBe('125.01');
    expect(parseProviderAmountToPaise('125.01')).toBe(12501);
  });
});
