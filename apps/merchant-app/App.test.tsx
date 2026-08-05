import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { MerchantAppContent, MerchantApplicationRoot } from './App';

jest.mock('./src/orders/default-merchant-orders', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DefaultMerchantOrders: function MockMerchantOrders() {
      return <Text>Merchant orders workspace</Text>;
    },
  };
});

jest.mock('./src/inventory/merchant-inventory.screen', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DefaultMerchantInventory: function MockMerchantInventory() {
      return <Text>Merchant inventory workspace</Text>;
    },
  };
});

jest.mock('./src/auth/default-merchant-session', () => ({
  MerchantSessionApp: ({ children }: { readonly children: ReactNode }) => children,
}));

describe('MerchantAppContent', () => {
  it('opens orders by default and switches to inventory', () => {
    const view = render(<MerchantAppContent />);

    expect(view.getByText('Merchant orders workspace')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Open merchant inventory scanner'));
    expect(view.getByText('Merchant inventory workspace')).toBeTruthy();
    expect(view.queryByText('Merchant orders workspace')).toBeNull();
  });

  it('mounts merchant operations inside the shared mobile shell', () => {
    const { getByTestId } = render(<MerchantApplicationRoot />);

    expect(getByTestId('merchant-application-shell')).toBeTruthy();
  });
});
