import { getCustomerOrderStatusPresentation } from './customer-order-status';

describe('customer order status presentation', () => {
  it('centralizes tracking and OTP lifecycle decisions', () => {
    expect(getCustomerOrderStatusPresentation('OUT_FOR_DELIVERY')).toMatchObject({
      primaryAction: 'VIEW_TRACKING',
      trackingAvailability: 'AVAILABLE',
      deliveryOtpVisibility: 'HIDDEN',
    });
    expect(getCustomerOrderStatusPresentation('CAPTAIN_AT_CUSTOMER')).toMatchObject({
      trackingAvailability: 'AVAILABLE',
      deliveryOtpVisibility: 'VISIBLE',
    });
    expect(getCustomerOrderStatusPresentation('COMPLETED')).toMatchObject({
      terminal: true,
      deliveryOtpVisibility: 'HIDDEN',
    });
  });

  it('degrades unknown backend statuses to customer-safe copy', () => {
    expect(getCustomerOrderStatusPresentation('INTERNAL_NEW_STATE')).toEqual(
      expect.objectContaining({
        title: 'Order update available',
        trackingAvailability: 'UNAVAILABLE',
        deliveryOtpVisibility: 'HIDDEN',
      }),
    );
  });
});
