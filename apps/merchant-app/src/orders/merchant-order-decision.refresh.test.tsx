import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { MerchantOrderDecisionActions } from './merchant-order-decision.screen';
import {
  MerchantOrderError,
  type MerchantOrderDecisionPort,
  type MerchantOrderDetail,
} from './merchant-order.types';

const ORDER = {
  id: '10000000-0000-4000-8000-000000000001',
  orderNumber: 'VAS-1',
  status: 'WAITING_FOR_MERCHANT',
} as MerchantOrderDetail;

describe('MerchantOrderDecisionActions authoritative recovery', () => {
  it('requests an authoritative refresh and does not offer mutation retry after an invalid-state race', async () => {
    const decisionClient: MerchantOrderDecisionPort = {
      acceptOrder: jest.fn(() =>
        Promise.reject(
          new MerchantOrderError('INVALID_STATE', 'MERCHANT_ORDER_INVALID_STATE', false),
        ),
      ),
      rejectOrder: jest.fn(),
    };
    const refresh = jest.fn();
    const view = render(
      <MerchantOrderDecisionActions
        decisionClient={decisionClient}
        onAuthoritativeRefreshRequested={refresh}
        onDecisionComplete={jest.fn()}
        order={ORDER}
      />,
    );

    fireEvent.press(view.getByLabelText('Accept complete merchant order'));
    fireEvent.press(view.getByLabelText('Confirm merchant order acceptance'));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(
      view.getByText('This order changed on the server. Refresh it before deciding again.'),
    ).toBeTruthy();
    expect(view.queryByLabelText('Retry same merchant order decision')).toBeNull();
  });

  it('marks the same decision surface for urgent-alert composition', () => {
    const decisionClient: MerchantOrderDecisionPort = {
      acceptOrder: jest.fn(),
      rejectOrder: jest.fn(),
    };
    const view = render(
      <MerchantOrderDecisionActions
        context="URGENT_ALERT"
        decisionClient={decisionClient}
        onDecisionComplete={jest.fn()}
        order={ORDER}
      />,
    );

    expect(view.getByLabelText('Merchant order decision actions in urgent alert')).toBeTruthy();
    expect(view.getByTestId('merchant-order-decision-actions')).toBeTruthy();
  });
});
