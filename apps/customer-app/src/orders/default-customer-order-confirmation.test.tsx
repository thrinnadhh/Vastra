import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CustomerOrderConfirmationRoute } from './default-customer-order-confirmation';

jest.mock('../api/use-customer-api-client', () => ({
  useCustomerApiClient: jest.fn(),
}));
jest.mock('./api-customer-order.adapter', () => ({
  ApiCustomerOrderAdapter: jest.fn(),
}));
import { CustomerOrderError, type CustomerOrderDetail } from './customer-order.types';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const CART_ID = '30000000-0000-4000-8000-000000000001';
const QUOTE_ID = '40000000-0000-4000-8000-000000000001';
const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';

const ORDER = {
  id: ORDER_ID,
  orderNumber: 'VAS-SYNTH-0001',
  cartId: CART_ID,
  quoteId: QUOTE_ID,
  shop: { id: '50000000-0000-4000-8000-000000000001', name: 'Synthetic Shop', slug: 'synthetic' },
  address: {
    id: ADDRESS_ID,
    label: 'Home',
    recipientName: 'Synthetic Customer',
    phoneNumber: '9000000001',
    line1: 'Synthetic Street',
    line2: null,
    landmark: null,
    area: 'Tirupati',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    postalCode: '517501',
    countryCode: 'IN',
    latitude: 13.6,
    longitude: 79.4,
  },
  status: 'WAITING_FOR_MERCHANT',
  paymentStatus: 'COD_PENDING',
  fulfilmentType: 'DELIVERY',
  items: [],
  itemCount: 0,
  totals: {
    subtotalPaise: 0,
    productDiscountPaise: 0,
    couponDiscountPaise: 0,
    deliveryFeePaise: 0,
    platformFeePaise: 0,
    taxPaise: 0,
    totalPaise: 0,
  },
  estimatedDeliveryAt: null,
  customerNote: null,
  history: [],
  placedAt: '2026-07-16T10:01:00.000Z',
  acceptedAt: null,
  readyAt: null,
  pickedUpAt: null,
  deliveredAt: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: '2026-07-16T10:01:00.000Z',
  updatedAt: '2026-07-16T10:01:00.000Z',
} satisfies CustomerOrderDetail;

const actions = {
  onViewOrder: jest.fn(),
  onViewOrders: jest.fn(),
  onContinueShopping: jest.fn(),
};

describe('CustomerOrderConfirmationRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads confirmation from the owned order read operation', async () => {
    const getOrder = jest.fn(() => Promise.resolve(ORDER));
    const view = render(
      <CustomerOrderConfirmationRoute
        {...actions}
        expectedAddressId={ADDRESS_ID}
        expectedCartId={CART_ID}
        expectedQuoteId={QUOTE_ID}
        onSecurityFailure={jest.fn()}
        orderClient={{ getOrder }}
        orderId={ORDER_ID}
      />,
    );

    expect(await view.findByLabelText('Order number VAS-SYNTH-0001')).toBeTruthy();
    expect(getOrder).toHaveBeenCalledWith(ORDER_ID);
  });

  it('purges all confirmation data when the response belongs to another transaction', async () => {
    const onSecurityFailure = jest.fn();
    const view = render(
      <CustomerOrderConfirmationRoute
        {...actions}
        expectedAddressId={ADDRESS_ID}
        expectedCartId={CART_ID}
        expectedQuoteId={QUOTE_ID}
        onSecurityFailure={onSecurityFailure}
        orderClient={{ getOrder: () => Promise.resolve({ ...ORDER, quoteId: 'other-quote' }) }}
        orderId={ORDER_ID}
      />,
    );

    expect(
      await view.findByText('This confirmed order is unavailable for the current account.'),
    ).toBeTruthy();
    expect(view.queryByText('Synthetic Customer')).toBeNull();
    expect(onSecurityFailure).toHaveBeenCalledTimes(1);
  });

  it('purges snapshots after authentication or authorization denial', async () => {
    const onSecurityFailure = jest.fn();
    const view = render(
      <CustomerOrderConfirmationRoute
        {...actions}
        onSecurityFailure={onSecurityFailure}
        orderClient={{
          getOrder: () => Promise.reject(new CustomerOrderError('FORBIDDEN', null, false)),
        }}
        orderId={ORDER_ID}
      />,
    );

    expect(
      await view.findByText('This confirmed order is unavailable for the current account.'),
    ).toBeTruthy();
    expect(view.queryByText('Synthetic Customer')).toBeNull();
    expect(onSecurityFailure).toHaveBeenCalledTimes(1);
  });

  it('retries a temporary transport failure without resubmitting placement', async () => {
    const getOrder = jest
      .fn()
      .mockRejectedValueOnce(new CustomerOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce(ORDER);
    const view = render(
      <CustomerOrderConfirmationRoute
        {...actions}
        onSecurityFailure={jest.fn()}
        orderClient={{ getOrder }}
        orderId={ORDER_ID}
      />,
    );

    expect(await view.findByText('You are offline')).toBeTruthy();
    fireEvent.press(await view.findByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(getOrder).toHaveBeenCalledTimes(2);
    });
    expect(await view.findByLabelText('Order number VAS-SYNTH-0001')).toBeTruthy();
  });
});
