import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { MerchantOrderDecisionActions } from './merchant-order-decision.screen';
import {
  MerchantOrderError,
  type MerchantOrderDecisionPort,
  type MerchantOrderDecisionResult,
  type MerchantOrderDetail,
} from './merchant-order.types';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';

function order(
  status: MerchantOrderDetail['status'] = 'WAITING_FOR_MERCHANT',
): MerchantOrderDetail {
  return {
    id: ORDER_ID,
    orderNumber: 'VAS-1',
    cartId: null,
    quoteId: null,
    shop: { id: '20000000-0000-4000-8000-000000000001', name: 'Shop', slug: 'shop' },
    address: {
      id: '30000000-0000-4000-8000-000000000001',
      label: null,
      recipientName: 'Asha',
      phoneNumber: '9000000000',
      line1: 'Road',
      line2: null,
      landmark: null,
      area: 'Tirupati',
      city: 'Tirupati',
      state: 'AP',
      postalCode: '517501',
      countryCode: 'IN',
      latitude: 13,
      longitude: 79,
    },
    status,
    paymentStatus: 'COD_PENDING',
    fulfilmentType: 'DELIVERY',
    items: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        productId: '50000000-0000-4000-8000-000000000001',
        variantId: '60000000-0000-4000-8000-000000000001',
        productName: 'Kurta',
        sku: 'K-M',
        colourName: 'Blue',
        sizeLabel: 'M',
        imageObjectKey: null,
        quantity: 1,
        unitMrpPaise: 10000,
        unitSellingPricePaise: 10000,
        discountPaise: 0,
        totalPaise: 10000,
      },
    ],
    itemCount: 1,
    previewImageObjectKey: null,
    totals: {
      subtotalPaise: 10000,
      productDiscountPaise: 0,
      couponDiscountPaise: 0,
      deliveryFeePaise: 0,
      platformFeePaise: 0,
      taxPaise: 0,
      totalPaise: 10000,
    },
    alert: null,
    estimatedDeliveryAt: null,
    customerNote: null,
    cancellationReasonCode: null,
    cancellationNote: null,
    history: [
      {
        id: '1',
        previousStatus: null,
        newStatus: 'WAITING_FOR_MERCHANT',
        changedByRole: 'SYSTEM',
        reasonCode: null,
        note: null,
        createdAt: '2026-07-17T01:00:00.000Z',
      },
    ],
    placedAt: '2026-07-17T01:00:00.000Z',
    acceptedAt: null,
    readyAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: '2026-07-17T01:00:00.000Z',
    updatedAt: '2026-07-17T01:00:00.000Z',
  };
}

function result(status: MerchantOrderDecisionResult['status']): MerchantOrderDecisionResult {
  return {
    orderId: ORDER_ID,
    orderNumber: 'VAS-1',
    status,
    alertStatus: 'ACKNOWLEDGED',
    merchantPreparationMinutes: status === 'MERCHANT_ACCEPTED' ? 30 : null,
    acceptedAt: status === 'MERCHANT_ACCEPTED' ? '2026-07-17T01:10:00.000Z' : null,
    cancelledAt: status === 'CANCELLED' ? '2026-07-17T01:10:00.000Z' : null,
    cancellationReasonCode: status === 'CANCELLED' ? 'SHOP_BUSY' : null,
    cancellationNote: null,
    reservationsReleased: status === 'CANCELLED' ? 1 : 0,
    replayed: false,
  };
}

function clients(
  acceptOrder: jest.MockedFunction<MerchantOrderDecisionPort['acceptOrder']> = jest.fn<
    ReturnType<MerchantOrderDecisionPort['acceptOrder']>,
    Parameters<MerchantOrderDecisionPort['acceptOrder']>
  >(() => Promise.resolve(result('MERCHANT_ACCEPTED'))),
  rejectOrder: jest.MockedFunction<MerchantOrderDecisionPort['rejectOrder']> = jest.fn<
    ReturnType<MerchantOrderDecisionPort['rejectOrder']>,
    Parameters<MerchantOrderDecisionPort['rejectOrder']>
  >(() => Promise.resolve(result('CANCELLED'))),
): MerchantOrderDecisionPort {
  return { acceptOrder, rejectOrder };
}

describe('MerchantOrderDecisionActions', () => {
  it('validates preparation time from 1 through 240', () => {
    const acceptOrder = jest.fn<
      ReturnType<MerchantOrderDecisionPort['acceptOrder']>,
      Parameters<MerchantOrderDecisionPort['acceptOrder']>
    >();
    const view = render(
      <MerchantOrderDecisionActions
        decisionClient={clients(acceptOrder)}
        onDecisionComplete={jest.fn()}
        order={order()}
      />,
    );
    fireEvent.press(view.getByLabelText('Accept complete merchant order'));
    fireEvent.changeText(view.getByLabelText('Merchant preparation time in minutes'), '0');
    fireEvent.press(view.getByLabelText('Confirm merchant order acceptance'));
    expect(
      view.getByText('Preparation time must be a whole number from 1 to 240 minutes.'),
    ).toBeTruthy();
    expect(acceptOrder.mock.calls).toHaveLength(0);
  });

  it('blocks duplicate acceptance taps while the command is in flight', async () => {
    let resolveDecision: ((value: MerchantOrderDecisionResult) => void) | undefined;
    const acceptOrder = jest.fn<
      ReturnType<MerchantOrderDecisionPort['acceptOrder']>,
      Parameters<MerchantOrderDecisionPort['acceptOrder']>
    >(
      () =>
        new Promise((resolve) => {
          resolveDecision = resolve;
        }),
    );
    const onComplete = jest.fn();
    const view = render(
      <MerchantOrderDecisionActions
        decisionClient={clients(acceptOrder)}
        onDecisionComplete={onComplete}
        order={order()}
      />,
    );
    fireEvent.press(view.getByLabelText('Accept complete merchant order'));
    fireEvent.changeText(view.getByLabelText('Merchant preparation time in minutes'), '45');
    fireEvent.press(view.getByLabelText('Confirm merchant order acceptance'));
    fireEvent.press(view.getByLabelText('Confirm merchant order acceptance'));
    expect(acceptOrder.mock.calls).toEqual([[ORDER_ID, { preparationMinutes: 45 }]]);
    await act(async () => {
      resolveDecision?.(result('MERCHANT_ACCEPTED'));
      await Promise.resolve();
    });
    expect(onComplete.mock.calls).toHaveLength(1);
  });

  it('requires a rejection reason and retries the exact same decision after an offline failure', async () => {
    const rejectOrder = jest
      .fn<
        ReturnType<MerchantOrderDecisionPort['rejectOrder']>,
        Parameters<MerchantOrderDecisionPort['rejectOrder']>
      >()
      .mockRejectedValueOnce(new MerchantOrderError('TRANSPORT', null, true))
      .mockResolvedValueOnce(result('CANCELLED'));
    const onComplete = jest.fn();
    const view = render(
      <MerchantOrderDecisionActions
        decisionClient={clients(undefined, rejectOrder)}
        onDecisionComplete={onComplete}
        order={order()}
      />,
    );
    fireEvent.press(view.getByLabelText('Reject complete merchant order'));
    fireEvent.press(view.getByLabelText('Confirm merchant order rejection'));
    expect(view.getByText('Choose a valid rejection reason.')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Select rejection reason SHOP_BUSY'));
    fireEvent.changeText(view.getByLabelText('Merchant rejection note'), 'Closing early');
    fireEvent.press(view.getByLabelText('Confirm merchant order rejection'));
    expect(await view.findByText(/appear to be offline/u)).toBeTruthy();
    fireEvent.press(view.getByLabelText('Retry same merchant order decision'));
    await waitFor(() => {
      expect(onComplete.mock.calls).toHaveLength(1);
    });
    expect(rejectOrder.mock.calls).toEqual([
      [ORDER_ID, { reasonCode: 'SHOP_BUSY', orderItemId: null, note: 'Closing early' }],
      [ORDER_ID, { reasonCode: 'SHOP_BUSY', orderItemId: null, note: 'Closing early' }],
    ]);
  });

  it('requires refresh for a stale transition and hides actions after a decision', async () => {
    const acceptOrder = jest.fn<
      ReturnType<MerchantOrderDecisionPort['acceptOrder']>,
      Parameters<MerchantOrderDecisionPort['acceptOrder']>
    >(() =>
      Promise.reject(
        new MerchantOrderError('INVALID_STATE', 'MERCHANT_ORDER_INVALID_STATE', false),
      ),
    );
    const view = render(
      <MerchantOrderDecisionActions
        decisionClient={clients(acceptOrder)}
        onDecisionComplete={jest.fn()}
        order={order()}
      />,
    );
    fireEvent.press(view.getByLabelText('Accept complete merchant order'));
    fireEvent.press(view.getByLabelText('Confirm merchant order acceptance'));
    expect(
      await view.findByText('This order changed on the server. Refresh it before deciding again.'),
    ).toBeTruthy();
    expect(view.queryByLabelText('Retry same merchant order decision')).toBeNull();

    view.rerender(
      <MerchantOrderDecisionActions
        decisionClient={clients()}
        onDecisionComplete={jest.fn()}
        order={order('MERCHANT_ACCEPTED')}
      />,
    );
    expect(view.getByText('Decision is no longer pending')).toBeTruthy();
  });
});
