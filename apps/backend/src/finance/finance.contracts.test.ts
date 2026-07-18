import { describe, expect, it } from 'vitest';

import {
  FINANCE_LOCK_ORDER,
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_STATUS_TRANSITIONS,
  REFUND_STATUSES,
  REFUND_STATUS_TRANSITIONS,
  RETURN_REQUEST_STATUSES,
  RETURN_STATUS_TRANSITIONS,
  canTransitionPayment,
  canTransitionRefund,
  canTransitionReturn,
  formatPaiseForProvider,
  parseProviderAmountToPaise,
} from './finance.contracts';

describe('Sprint 10 finance contracts', () => {
  it('keeps every canonical state represented in its transition map', () => {
    expect(Object.keys(PAYMENT_STATUS_TRANSITIONS).sort()).toEqual(
      [...PAYMENT_ATTEMPT_STATUSES].sort(),
    );
    expect(Object.keys(RETURN_STATUS_TRANSITIONS).sort()).toEqual(
      [...RETURN_REQUEST_STATUSES].sort(),
    );
    expect(Object.keys(REFUND_STATUS_TRANSITIONS).sort()).toEqual([...REFUND_STATUSES].sort());
  });

  it('prevents terminal financial states from regressing', () => {
    expect(canTransitionPayment('REFUNDED', 'CAPTURED')).toBe(false);
    expect(canTransitionPayment('FAILED', 'PENDING')).toBe(false);
    expect(canTransitionReturn('CLOSED', 'REVIEW')).toBe(false);
    expect(canTransitionRefund('COMPLETED', 'PROCESSING')).toBe(false);
  });

  it('allows only the explicitly frozen recovery transitions', () => {
    expect(canTransitionPayment('PENDING', 'CAPTURED')).toBe(true);
    expect(canTransitionReturn('RECEIVED', 'REVIEW')).toBe(true);
    expect(canTransitionRefund('FAILED', 'INITIATED')).toBe(true);
  });

  it('converts provider amounts without floating-point arithmetic', () => {
    expect(formatPaiseForProvider(1)).toBe('0.01');
    expect(formatPaiseForProvider(1034)).toBe('10.34');
    expect(parseProviderAmountToPaise('10.34')).toBe(1034);
    expect(() => parseProviderAmountToPaise('10.3')).toThrow(RangeError);
    expect(() => formatPaiseForProvider(0)).toThrow(RangeError);
  });

  it('freezes the cross-domain database lock order', () => {
    expect(FINANCE_LOCK_ORDER).toEqual([
      'ORDER',
      'PAYMENT',
      'PAYMENT_EVENT',
      'RETURN_REQUEST',
      'RETURN_ITEM',
      'REFUND',
      'MERCHANT_SETTLEMENT',
      'CAPTAIN_EARNING',
      'CAPTAIN_PAYOUT',
    ]);
  });
});
