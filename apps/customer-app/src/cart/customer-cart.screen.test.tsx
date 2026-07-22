import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { CustomerCartReplacementPrompt } from './customer-cart-replacement.prompt';
import { CustomerCartScreen } from './customer-cart.screen';
import { CustomerCartError, type CustomerCart, type CustomerCartPort } from './customer-cart.types';

const ITEM = {
  id: '60000000-0000-4000-8000-000000000001',
  variantId: '70000000-0000-4000-8000-000000000001',
  productId: '80000000-0000-4000-8000-000000000001',
  productName: 'Blue Kurta',
  productSlug: 'blue-kurta',
  sku: 'BLUE-M',
  colourName: 'Blue',
  sizeLabel: 'M',
  imageObjectKey: null,
  quantity: 2,
  unitPricePaise: 25000,
  currentUnitPricePaise: 26000,
  priceChanged: true,
  availableQuantity: 4,
  isAvailable: true,
  lineTotalPaise: 50000,
  currentLineTotalPaise: 52000,
  addedAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
} as const;

const CART: CustomerCart = {
  id: '30000000-0000-4000-8000-000000000001',
  shop: {
    id: '40000000-0000-4000-8000-000000000001',
    name: 'Vastra Shop',
    slug: 'vastra-shop',
    logoObjectKey: null,
    operationalStatus: 'OPEN',
    acceptsOnlineOrders: true,
  },
  items: [ITEM],
  itemCount: 2,
  subtotalPaise: 50000,
  currentSubtotalPaise: 52000,
  hasPriceChanges: true,
  hasUnavailableItems: false,
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
};

function port(overrides: Partial<CustomerCartPort> = {}): CustomerCartPort {
  return {
    getCart: jest.fn().mockResolvedValue(CART),
    setItem: jest.fn().mockResolvedValue(CART),
    updateItem: jest.fn().mockResolvedValue({ ...CART, hasPriceChanges: false }),
    removeItem: jest.fn().mockResolvedValue(null),
    clearCart: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('CustomerCartScreen', () => {
  it('renders loading and an empty cart', async () => {
    let resolve: ((cart: CustomerCart | null) => void) | undefined;
    const pending = new Promise<CustomerCart | null>((value) => {
      resolve = value;
    });
    const view = render(
      <CustomerCartScreen cartClient={port({ getCart: () => pending })} onCheckout={jest.fn()} />,
    );
    expect(view.getByLabelText('Loading current cart price and availability')).toBeTruthy();
    act(() => {
      resolve?.(null);
    });
    expect(await view.findByText('Your cart is empty')).toBeTruthy();
  });

  it('retries an offline load', async () => {
    const getCart = jest
      .fn()
      .mockRejectedValueOnce(new CustomerCartError('TRANSPORT', null, true))
      .mockResolvedValueOnce(CART);
    const view = render(
      <CustomerCartScreen cartClient={port({ getCart })} onCheckout={jest.fn()} />,
    );
    fireEvent.press(await view.findByRole('button', { name: 'Try again' }));
    expect(await view.findByText('Blue Kurta')).toBeTruthy();
    expect(getCart).toHaveBeenCalledTimes(2);
  });

  it('updates, removes, and directly submits quantity', async () => {
    const updateItem = jest.fn().mockResolvedValue({ ...CART, hasPriceChanges: false });
    const removeItem = jest.fn().mockResolvedValue(null);
    const view = render(
      <CustomerCartScreen cartClient={port({ updateItem, removeItem })} onCheckout={jest.fn()} />,
    );
    fireEvent.press(await view.findByRole('button', { name: 'Increase Blue Kurta quantity' }));
    await waitFor(() => {
      expect(updateItem).toHaveBeenCalledWith(ITEM.id, 3);
    });

    fireEvent.changeText(await view.findByLabelText('Direct quantity for Blue Kurta'), '1');
    fireEvent(view.getByLabelText('Direct quantity for Blue Kurta'), 'submitEditing');
    await waitFor(() => {
      expect(updateItem).toHaveBeenCalledWith(ITEM.id, 1);
    });

    fireEvent.press(await view.findByRole('button', { name: 'Remove Blue Kurta from cart' }));
    await waitFor(() => {
      expect(removeItem).toHaveBeenCalledWith(ITEM.id);
    });
  });

  it('requires confirmation before clearing', async () => {
    const clearCart = jest.fn().mockResolvedValue(null);
    const view = render(
      <CustomerCartScreen cartClient={port({ clearCart })} onCheckout={jest.fn()} />,
    );
    fireEvent.press(await view.findByRole('button', { name: 'Clear all cart items' }));
    expect(view.getByText('Clear this cart?')).toBeTruthy();
    expect(clearCart).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole('button', { name: 'Confirm clear cart' }));
    await waitFor(() => {
      expect(clearCart).toHaveBeenCalledTimes(1);
    });
  });

  it('blocks duplicate quantity submissions', async () => {
    let resolve: ((cart: CustomerCart | null) => void) | undefined;
    const pending = new Promise<CustomerCart | null>((value) => {
      resolve = value;
    });
    const updateItem = jest.fn(() => pending);
    const view = render(
      <CustomerCartScreen cartClient={port({ updateItem })} onCheckout={jest.fn()} />,
    );
    fireEvent.press(await view.findByRole('button', { name: 'Increase Blue Kurta quantity' }));
    fireEvent.press(view.getByRole('button', { name: 'Increase Blue Kurta quantity' }));
    expect(updateItem).toHaveBeenCalledTimes(1);
    act(() => {
      resolve?.(CART);
    });
  });

  it('refreshes after unavailable inventory and exposes session expiry', async () => {
    const onSessionExpired = jest.fn();
    const getCart = jest
      .fn()
      .mockResolvedValueOnce(CART)
      .mockResolvedValueOnce({
        ...CART,
        items: [{ ...ITEM, isAvailable: false }],
        hasUnavailableItems: true,
      });
    const updateItem = jest
      .fn()
      .mockRejectedValueOnce(
        new CustomerCartError('INVENTORY_CONFLICT', 'INSUFFICIENT_INVENTORY', false),
      )
      .mockRejectedValueOnce(new CustomerCartError('AUTHENTICATION', null, false));
    const view = render(
      <CustomerCartScreen
        cartClient={port({ getCart, updateItem })}
        onCheckout={jest.fn()}
        onSessionExpired={onSessionExpired}
      />,
    );
    fireEvent.press(await view.findByRole('button', { name: 'Increase Blue Kurta quantity' }));
    await waitFor(() => {
      expect(getCart).toHaveBeenCalledTimes(2);
    });
    expect(await view.findByText('AVAILABILITY CHANGED')).toBeTruthy();

    fireEvent.press(view.getByRole('button', { name: 'Decrease Blue Kurta quantity' }));
    await waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps checkout disabled for stale price or unavailable stock', async () => {
    const onCheckout = jest.fn();
    const view = render(<CustomerCartScreen cartClient={port()} onCheckout={onCheckout} />);
    expect(
      await view.findByRole('button', {
        name: 'Checkout unavailable until cart changes are resolved',
      }),
    ).toBeDisabled();
    fireEvent.press(
      view.getByRole('button', {
        name: 'Checkout unavailable until cart changes are resolved',
      }),
    );
    expect(onCheckout).not.toHaveBeenCalled();
  });

  it('renders accessible explicit one-shop replacement confirmation', () => {
    const onConfirm = jest.fn();
    const view = render(
      <CustomerCartReplacementPrompt
        currentShopName="Shop A"
        nextShopName="Shop B"
        isSubmitting={false}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.press(
      view.getByRole('button', { name: 'Clear Shop A cart and continue with Shop B' }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
