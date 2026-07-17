import {
  merchantAlertSecondsRemaining,
  shouldStopMerchantAlertForOrderStatus,
} from './merchant-alert-countdown';

describe('merchant alert countdown', () => {
  it('rounds a live response window up to whole seconds', () => {
    expect(
      merchantAlertSecondsRemaining('2026-07-17T09:00:05.250Z', Date.parse('2026-07-17T09:00:00.000Z')),
    ).toBe(6);
  });

  it('never returns a negative countdown', () => {
    expect(
      merchantAlertSecondsRemaining('2026-07-17T09:00:00.000Z', Date.parse('2026-07-17T09:00:01.000Z')),
    ).toBe(0);
  });

  it('stops foreground ringing after the authoritative order leaves waiting state', () => {
    expect(shouldStopMerchantAlertForOrderStatus('WAITING_FOR_MERCHANT')).toBe(false);
    expect(shouldStopMerchantAlertForOrderStatus('MERCHANT_ACCEPTED')).toBe(true);
    expect(shouldStopMerchantAlertForOrderStatus('CANCELLED')).toBe(true);
  });
});
