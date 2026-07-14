import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { CustomerNetworkStateBoundary } from './customer-network-state';

describe('CustomerNetworkStateBoundary', () => {
  it('renders an accessible loading skeleton and hides unfinished content', () => {
    const { getByLabelText, queryByText } = render(
      <CustomerNetworkStateBoundary
        onRetry={jest.fn()}
        state={{ kind: 'LOADING', accessibilityLabel: 'Loading nearby shops' }}
      >
        <Text>Nearby shops</Text>
      </CustomerNetworkStateBoundary>,
    );

    expect(getByLabelText('Loading nearby shops')).toBeTruthy();
    expect(queryByText('Nearby shops')).toBeNull();
  });

  it('renders an empty state with an accessible action', () => {
    const onEmptyAction = jest.fn();
    const { getByRole, getByText } = render(
      <CustomerNetworkStateBoundary
        onEmptyAction={onEmptyAction}
        onRetry={jest.fn()}
        state={{
          kind: 'EMPTY',
          title: 'No favourites yet',
          message: 'Favourite a shop to find it here.',
          actionLabel: 'Browse shops',
        }}
      >
        <Text>Hidden content</Text>
      </CustomerNetworkStateBoundary>,
    );

    expect(getByText('No favourites yet')).toBeTruthy();
    fireEvent.press(getByRole('button', { name: 'Browse shops' }));
    expect(onEmptyAction).toHaveBeenCalledTimes(1);
  });

  it('renders a retryable error state', () => {
    const onRetry = jest.fn();
    const { getByRole, getByText } = render(
      <CustomerNetworkStateBoundary
        onRetry={onRetry}
        state={{
          kind: 'ERROR',
          title: 'Something went wrong',
          message: 'The cart could not be refreshed.',
          retryLabel: 'Try again',
        }}
      >
        <Text>Hidden content</Text>
      </CustomerNetworkStateBoundary>,
    );

    expect(getByText('The cart could not be refreshed.')).toBeTruthy();
    fireEvent.press(getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders a retryable offline state without relying on colour alone', () => {
    const { getByRole, getByText } = render(
      <CustomerNetworkStateBoundary
        onRetry={jest.fn()}
        state={{
          kind: 'OFFLINE',
          title: 'You are offline',
          message: 'Reconnect to load the latest products.',
          retryLabel: 'Try again',
        }}
      >
        <Text>Hidden content</Text>
      </CustomerNetworkStateBoundary>,
    );

    expect(getByText('OFFLINE')).toBeTruthy();
    expect(getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('keeps stale content visible with an offline explanation', () => {
    const { getByLabelText, getByText } = render(
      <CustomerNetworkStateBoundary
        onRetry={jest.fn()}
        state={{ kind: 'SUCCESS', staleReason: 'OFFLINE' }}
      >
        <Text>Saved cart</Text>
      </CustomerNetworkStateBoundary>,
    );

    expect(getByText('Saved cart')).toBeTruthy();
    expect(getByLabelText('Offline. Showing saved information.')).toBeTruthy();
  });

  it('renders fresh success content without a stale-data banner', () => {
    const { getByText, queryByText } = render(
      <CustomerNetworkStateBoundary
        onRetry={jest.fn()}
        state={{ kind: 'SUCCESS', staleReason: null }}
      >
        <Text>Fresh home feed</Text>
      </CustomerNetworkStateBoundary>,
    );

    expect(getByText('Fresh home feed')).toBeTruthy();
    expect(queryByText('STALE DATA')).toBeNull();
  });
});
