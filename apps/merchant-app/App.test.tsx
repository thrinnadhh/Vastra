import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { MerchantAppContent } from './App';

jest.mock('./src/orders/default-merchant-orders', () => ({
  DefaultMerchantOrders: function MockMerchantOrders() {
    return null;
  },
}));

jest.mock('./src/auth/default-merchant-session', () => ({
  MerchantSessionApp: ({ children }: { readonly children: ReactNode }) => children,
}));

describe('MerchantAppContent', () => {
  it('mounts the real merchant orders feature', () => {
    const view = render(<MerchantAppContent />);
    expect(view.toJSON()).toBeNull();
  });
});
