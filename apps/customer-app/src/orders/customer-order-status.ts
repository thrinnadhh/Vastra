import type { CustomerOrderKnownStatus } from './customer-order.types';

export type CustomerOrderTimelineStage =
  'PLACED' | 'SHOP_REVIEW' | 'PREPARING' | 'DELIVERY' | 'COMPLETE' | 'ATTENTION';
export type CustomerOrderAction = 'VIEW_ORDER' | 'VIEW_TRACKING' | 'REFRESH' | 'NONE';
export type CustomerTrackingAvailability = 'NOT_STARTED' | 'AVAILABLE' | 'UNAVAILABLE';
export type CustomerDeliveryOtpVisibility = 'HIDDEN' | 'VISIBLE';

export interface CustomerOrderStatusPresentation {
  readonly title: string;
  readonly description: string;
  readonly timelineStage: CustomerOrderTimelineStage;
  readonly primaryAction: CustomerOrderAction;
  readonly secondaryAction: CustomerOrderAction;
  readonly trackingAvailability: CustomerTrackingAvailability;
  readonly deliveryOtpVisibility: CustomerDeliveryOtpVisibility;
  readonly refreshBehavior: 'STANDARD' | 'FREQUENT';
  readonly terminal: boolean;
}

const status = (
  title: string,
  description: string,
  timelineStage: CustomerOrderTimelineStage,
  options: Partial<
    Omit<CustomerOrderStatusPresentation, 'title' | 'description' | 'timelineStage'>
  > = {},
): CustomerOrderStatusPresentation => ({
  title,
  description,
  timelineStage,
  primaryAction: options.primaryAction ?? 'VIEW_ORDER',
  secondaryAction: options.secondaryAction ?? 'NONE',
  trackingAvailability: options.trackingAvailability ?? 'NOT_STARTED',
  deliveryOtpVisibility: options.deliveryOtpVisibility ?? 'HIDDEN',
  refreshBehavior: options.refreshBehavior ?? 'STANDARD',
  terminal: options.terminal ?? false,
});

const PRESENTATIONS: Readonly<Record<CustomerOrderKnownStatus, CustomerOrderStatusPresentation>> = {
  PAYMENT_PENDING: status(
    'Confirming payment',
    'The order is waiting for payment confirmation.',
    'PLACED',
  ),
  WAITING_FOR_MERCHANT: status(
    'Waiting for shop',
    'The shop is reviewing your order.',
    'SHOP_REVIEW',
    { refreshBehavior: 'FREQUENT' },
  ),
  MERCHANT_ACCEPTED: status(
    'Order accepted',
    'The shop accepted your order and will begin preparing it.',
    'PREPARING',
  ),
  PACKING: status('Being packed', 'The shop is checking and packing your items.', 'PREPARING'),
  READY_FOR_PICKUP: status(
    'Ready for pickup',
    'Your parcel is packed and ready for a delivery partner.',
    'PREPARING',
  ),
  CAPTAIN_SEARCHING: status(
    'Finding a delivery partner',
    'We are matching a delivery partner to your order.',
    'DELIVERY',
    { trackingAvailability: 'NOT_STARTED', refreshBehavior: 'FREQUENT' },
  ),
  CAPTAIN_ASSIGNED: status(
    'Delivery partner assigned',
    'A delivery partner is heading to the shop.',
    'DELIVERY',
    {
      primaryAction: 'VIEW_TRACKING',
      trackingAvailability: 'AVAILABLE',
      refreshBehavior: 'FREQUENT',
    },
  ),
  CAPTAIN_AT_STORE: status(
    'Partner at the shop',
    'Your delivery partner is collecting the parcel.',
    'DELIVERY',
    {
      primaryAction: 'VIEW_TRACKING',
      trackingAvailability: 'AVAILABLE',
      refreshBehavior: 'FREQUENT',
    },
  ),
  PICKED_UP: status('Order picked up', 'Your parcel has left the shop.', 'DELIVERY', {
    primaryAction: 'VIEW_TRACKING',
    trackingAvailability: 'AVAILABLE',
    refreshBehavior: 'FREQUENT',
  }),
  OUT_FOR_DELIVERY: status(
    'Out for delivery',
    'Your delivery partner is travelling to your address.',
    'DELIVERY',
    {
      primaryAction: 'VIEW_TRACKING',
      trackingAvailability: 'AVAILABLE',
      refreshBehavior: 'FREQUENT',
    },
  ),
  CAPTAIN_AT_CUSTOMER: status(
    'Partner has arrived',
    'Check the parcel, then share the delivery OTP with the delivery partner.',
    'DELIVERY',
    {
      primaryAction: 'VIEW_TRACKING',
      trackingAvailability: 'AVAILABLE',
      deliveryOtpVisibility: 'VISIBLE',
      refreshBehavior: 'FREQUENT',
    },
  ),
  DELIVERED: status('Delivered', 'The parcel was handed over successfully.', 'COMPLETE', {
    trackingAvailability: 'UNAVAILABLE',
    terminal: true,
  }),
  COMPLETED: status('Order completed', 'This order is complete.', 'COMPLETE', {
    trackingAvailability: 'UNAVAILABLE',
    terminal: true,
  }),
  PROBLEM_REPORTED: status(
    'Delivery needs attention',
    'A delivery issue was reported and the order is being reviewed.',
    'ATTENTION',
    { secondaryAction: 'REFRESH', trackingAvailability: 'UNAVAILABLE' },
  ),
  CANCELLED: status('Order cancelled', 'This order was cancelled.', 'COMPLETE', {
    trackingAvailability: 'UNAVAILABLE',
    terminal: true,
  }),
};

const UNKNOWN_PRESENTATION = status(
  'Order update available',
  'Refresh to view the latest customer-safe order information.',
  'ATTENTION',
  { secondaryAction: 'REFRESH', trackingAvailability: 'UNAVAILABLE' },
);

export function getCustomerOrderStatusPresentation(
  orderStatus: string,
): CustomerOrderStatusPresentation {
  return Object.prototype.hasOwnProperty.call(PRESENTATIONS, orderStatus)
    ? PRESENTATIONS[orderStatus as CustomerOrderKnownStatus]
    : UNKNOWN_PRESENTATION;
}
