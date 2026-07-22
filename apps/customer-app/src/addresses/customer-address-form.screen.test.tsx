import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CUSTOMER_ADDRESS_FIXTURE } from './customer-address.fixtures';
import { CustomerAddressFormScreen } from './customer-address-form.screen';
import type { CustomerAddressPort } from './customer-address.types';

function createPort(): CustomerAddressPort & {
  readonly create: jest.Mock;
  readonly update: jest.Mock;
} {
  return {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    setDefault: jest.fn(),
  };
}

function fillValidForm(screen: ReturnType<typeof render>): void {
  fireEvent.changeText(screen.getByLabelText('Recipient name *'), 'Customer');
  fireEvent.changeText(screen.getByLabelText('Phone number *'), '+919000000001');
  fireEvent.changeText(screen.getByLabelText('Address line 1 *'), '12 Temple Road');
  fireEvent.changeText(screen.getByLabelText('Area *'), 'Tiruchanur');
  fireEvent.changeText(screen.getByLabelText('City *'), 'Tirupati');
  fireEvent.changeText(screen.getByLabelText('Postal code *'), '517501');
  fireEvent.changeText(screen.getByLabelText('Latitude *'), '13.6288');
  fireEvent.changeText(screen.getByLabelText('Longitude *'), '79.4192');
}

describe('CustomerAddressFormScreen', () => {
  it('shows field-level validation and prevents invalid submission', () => {
    const port = createPort();
    const screen = render(
      <CustomerAddressFormScreen
        address={null}
        addressPort={port}
        onCancel={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Save new address'));

    expect(screen.getByText('Recipient name is required.')).toBeTruthy();
    expect(screen.getByText('Postal code is required.')).toBeTruthy();
    expect(port.create).not.toHaveBeenCalled();
  });

  it('prevents duplicate submission and preserves one idempotency key across a recoverable retry', async () => {
    const port = createPort();
    port.create
      .mockResolvedValueOnce({
        kind: 'FAILURE',
        failureKind: 'OFFLINE',
        fieldErrors: {},
        requiresRefresh: false,
      })
      .mockResolvedValueOnce({ kind: 'SUCCESS', address: CUSTOMER_ADDRESS_FIXTURE });
    const onSaved = jest.fn();
    const createIdempotencyKey = jest.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const screen = render(
      <CustomerAddressFormScreen
        address={null}
        addressPort={port}
        createIdempotencyKey={createIdempotencyKey}
        onCancel={jest.fn()}
        onSaved={onSaved}
      />,
    );
    fillValidForm(screen);

    fireEvent.press(screen.getByLabelText('Save new address'));
    fireEvent.press(screen.getByLabelText('Save new address'));

    await waitFor(() => {
      expect(screen.getByText(/Your address details are still here/u)).toBeTruthy();
    });
    expect(port.create).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('Customer')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Save new address'));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(CUSTOMER_ADDRESS_FIXTURE);
    });
    expect(port.create).toHaveBeenCalledTimes(2);
    const expectedInput = {
      label: null,
      recipientName: 'Customer',
      phoneNumber: '+919000000001',
      line1: '12 Temple Road',
      line2: null,
      landmark: null,
      area: 'Tiruchanur',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      postalCode: '517501',
      countryCode: 'IN',
      latitude: 13.6288,
      longitude: 79.4192,
      isDefault: false,
    };
    expect(port.create).toHaveBeenNthCalledWith(
      1,
      expectedInput,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(port.create).toHaveBeenNthCalledWith(
      2,
      expectedInput,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(createIdempotencyKey).toHaveBeenCalledTimes(1);
  });

  it('edits using the server-owned address id', async () => {
    const port = createPort();
    port.update.mockResolvedValue({ kind: 'SUCCESS', address: CUSTOMER_ADDRESS_FIXTURE });
    const screen = render(
      <CustomerAddressFormScreen
        address={CUSTOMER_ADDRESS_FIXTURE}
        addressPort={port}
        createIdempotencyKey={() => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}
        onCancel={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByLabelText('Save address changes'));
    await waitFor(() => {
      expect(port.update).toHaveBeenCalledWith(
        CUSTOMER_ADDRESS_FIXTURE.id,
        {
          label: 'Home',
          recipientName: 'Vastra Customer',
          phoneNumber: '+919000000001',
          line1: '12 Temple Road',
          line2: null,
          landmark: 'Near the park',
          area: 'Tiruchanur',
          city: 'Tirupati',
          state: 'Andhra Pradesh',
          postalCode: '517501',
          countryCode: 'IN',
          latitude: 13.6288,
          longitude: 79.4192,
          isDefault: true,
        },
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      );
    });
  });
});
