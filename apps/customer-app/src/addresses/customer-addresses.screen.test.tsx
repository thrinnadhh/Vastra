import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CUSTOMER_ADDRESS_FIXTURE } from './customer-address.fixtures';
import { CustomerAddressesScreen } from './customer-addresses.screen';
import type { CustomerAddress, CustomerAddressPort } from './customer-address.types';

const SECOND: CustomerAddress = {
  ...CUSTOMER_ADDRESS_FIXTURE,
  id: '22222222-2222-4222-8222-222222222222',
  label: 'Office',
  isDefault: false,
};
const UNSERVICEABLE: CustomerAddress = {
  ...SECOND,
  id: '33333333-3333-4333-8333-333333333333',
  label: 'Outside area',
  serviceability: 'UNSERVICEABLE',
};
const UNKNOWN: CustomerAddress = {
  ...SECOND,
  id: '44444444-4444-4444-8444-444444444444',
  label: 'New location',
  serviceability: 'UNKNOWN',
};

function createPort(): CustomerAddressPort & {
  readonly list: jest.Mock;
  readonly remove: jest.Mock;
  readonly setDefault: jest.Mock;
} {
  return {
    list: jest.fn().mockResolvedValue({ kind: 'SUCCESS', addresses: [] }),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    setDefault: jest.fn(),
  };
}

describe('CustomerAddressesScreen', () => {
  it('shows the empty state and opens the add form', async () => {
    const screen = render(<CustomerAddressesScreen addressPort={createPort()} />);
    await waitFor(() => {
      expect(screen.getByText('No delivery addresses yet')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Add address'));
    expect(screen.getByText('Add delivery address')).toBeTruthy();
  });

  it('renders serviceable, unserviceable and unknown states without selecting ineligible checkout addresses', async () => {
    const port = createPort();
    port.list.mockResolvedValue({
      kind: 'SUCCESS',
      addresses: [CUSTOMER_ADDRESS_FIXTURE, UNSERVICEABLE, UNKNOWN],
    });
    const onSelectedAddressChange = jest.fn();
    const screen = render(
      <CustomerAddressesScreen
        addressPort={port}
        mode="CHECKOUT"
        onSelectedAddressChange={onSelectedAddressChange}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Serviceable')).toBeTruthy();
    });
    expect(screen.getByText('Unserviceable')).toBeTruthy();
    expect(screen.getByText('Serviceability unknown')).toBeTruthy();

    const selectButtons = screen.getAllByLabelText('Select address');
    fireEvent.press(selectButtons[0]);
    expect(onSelectedAddressChange).toHaveBeenCalledWith(CUSTOMER_ADDRESS_FIXTURE.id);
    expect(selectButtons[1]).toBeDisabled();
    expect(selectButtons[2]).toBeDisabled();
  });

  it('updates the server default once', async () => {
    const port = createPort();
    port.list.mockResolvedValue({ kind: 'SUCCESS', addresses: [CUSTOMER_ADDRESS_FIXTURE, SECOND] });
    port.setDefault.mockResolvedValue({ kind: 'SUCCESS', address: { ...SECOND, isDefault: true } });
    const screen = render(
      <CustomerAddressesScreen
        addressPort={port}
        createIdempotencyKey={() => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Office')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Set Office as default'));
    await waitFor(() => {
      expect(screen.getByText('Default address updated.')).toBeTruthy();
    });
    expect(port.setDefault).toHaveBeenCalledTimes(1);
    expect(port.setDefault).toHaveBeenCalledWith(SECOND.id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  });

  it('dismisses delete confirmation through the modal close request', async () => {
    const port = createPort();
    port.list.mockResolvedValue({ kind: 'SUCCESS', addresses: [CUSTOMER_ADDRESS_FIXTURE] });
    const screen = render(<CustomerAddressesScreen addressPort={port} />);

    await waitFor(() => {
      expect(screen.getByText('Home')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Delete Home'));
    expect(screen.getByText('Delete this address?')).toBeTruthy();

    fireEvent(screen.getByTestId('delete-address-modal'), 'requestClose');
    expect(screen.queryByText('Delete this address?')).toBeNull();
    expect(port.remove).not.toHaveBeenCalled();
  });

  it('uses the server deletion fallback and invalidates the checkout quote', async () => {
    const port = createPort();
    port.list
      .mockResolvedValueOnce({ kind: 'SUCCESS', addresses: [CUSTOMER_ADDRESS_FIXTURE, SECOND] })
      .mockResolvedValueOnce({ kind: 'SUCCESS', addresses: [{ ...SECOND, isDefault: true }] });
    port.remove.mockResolvedValue({
      kind: 'SUCCESS',
      deletedAddressId: CUSTOMER_ADDRESS_FIXTURE.id,
      defaultAddressId: SECOND.id,
    });
    const onSelectedAddressChange = jest.fn();
    const onInvalidateQuote = jest.fn();
    const screen = render(
      <CustomerAddressesScreen
        addressPort={port}
        mode="CHECKOUT"
        onInvalidateQuote={onInvalidateQuote}
        onSelectedAddressChange={onSelectedAddressChange}
        selectedAddressId={CUSTOMER_ADDRESS_FIXTURE.id}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Delete Home'));
    expect(screen.getByText('Delete this address?')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Confirm delete address'));
    await waitFor(() => {
      expect(port.remove).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(onSelectedAddressChange).toHaveBeenCalledWith(SECOND.id);
    });
    expect(onInvalidateQuote).toHaveBeenCalled();
  });

  it('keeps visible data and marks serviceability stale after an offline refresh', async () => {
    const port = createPort();
    port.list
      .mockResolvedValueOnce({ kind: 'SUCCESS', addresses: [CUSTOMER_ADDRESS_FIXTURE] })
      .mockResolvedValueOnce({
        kind: 'FAILURE',
        failureKind: 'OFFLINE',
        fieldErrors: {},
        requiresRefresh: false,
      });
    const screen = render(<CustomerAddressesScreen addressPort={port} mode="CHECKOUT" />);
    await waitFor(() => {
      expect(screen.getByText('Serviceable')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Refresh addresses'));
    await waitFor(() => {
      expect(screen.getByText('Serviceability stale')).toBeTruthy();
    });
    expect(screen.getByText('STALE DATA')).toBeTruthy();
  });

  it.each([
    ['SESSION_EXPIRED', 'Session expired'],
    ['UNAUTHORIZED', 'Address access unavailable'],
  ] as const)('shows the %s state with customer-safe copy', async (failureKind, title) => {
    const port = createPort();
    port.list.mockResolvedValue({
      kind: 'FAILURE',
      failureKind,
      fieldErrors: {},
      requiresRefresh: false,
    });
    const screen = render(<CustomerAddressesScreen addressPort={port} />);
    await waitFor(() => {
      expect(screen.getByText(title)).toBeTruthy();
    });
  });
});
