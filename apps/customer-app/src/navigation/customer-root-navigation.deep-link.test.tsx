import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import type { CustomerLinkingPort } from './customer-linking.port';
import {
  CustomerRootNavigation,
  type CustomerRootNavigationSlots,
} from './customer-root-navigation';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';

class LinkingPortStub implements CustomerLinkingPort {
  private listener: ((url: string) => void) | undefined;

  public constructor(public initialUrl: string | null) {}

  public getInitialUrl(): Promise<string | null> {
    return Promise.resolve(this.initialUrl);
  }

  public subscribe(listener: (url: string) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }

  public emit(url: string): void {
    this.listener?.(url);
  }
}

function createSlots(): CustomerRootNavigationSlots {
  return {
    home: () => <Text>Home root</Text>,
    discover: <Text>Discover root</Text>,
    style: <Text>Style root</Text>,
    orders: <Text>Orders root</Text>,
    profile: <Text>Profile root</Text>,
    checkout: <Text>Checkout root</Text>,
    renderDeepLinkedRoute: (route, onBack) =>
      route.scope === 'ORDERS' && route.name === 'OrderDetail' ? (
        <Pressable accessibilityRole="button" onPress={onBack}>
          <Text>{`Linked order ${route.params.orderId}`}</Text>
        </Pressable>
      ) : null,
  };
}

describe('CustomerRootNavigation deep-link ingress', () => {
  it('opens an initial owned-order destination and pops safely', async () => {
    const { findByRole, findByText } = render(
      <CustomerRootNavigation
        linkingPort={new LinkingPortStub(`vastra://order/${ORDER_ID}`)}
        slots={createSlots()}
      />,
    );

    expect(await findByText(`Linked order ${ORDER_ID}`)).toBeTruthy();
    fireEvent.press(await findByRole('button', { name: `Linked order ${ORDER_ID}` }));
    expect(await findByText('Orders root')).toBeTruthy();
    expect(await findByRole('tab', { name: 'Orders tab' })).toBeTruthy();
  });

  it('handles a valid link received while the application is running', async () => {
    const linkingPort = new LinkingPortStub(null);
    const { findByText } = render(
      <CustomerRootNavigation linkingPort={linkingPort} slots={createSlots()} />,
    );

    linkingPort.emit(`vastra://order/${ORDER_ID}`);
    expect(await findByText(`Linked order ${ORDER_ID}`)).toBeTruthy();
  });

  it('renders safe invalid-link recovery without exposing route data', async () => {
    const { findByRole, findByText, queryByText } = render(
      <CustomerRootNavigation
        linkingPort={new LinkingPortStub('vastra://order/not-a-uuid')}
        slots={createSlots()}
      />,
    );

    expect(await findByText('Link unavailable')).toBeTruthy();
    expect(queryByText('not-a-uuid')).toBeNull();
    fireEvent.press(await findByRole('button', { name: 'Return safely' }));
    expect(await findByText('Home root')).toBeTruthy();
  });

  it('rejects another Vastra application scheme', async () => {
    const { findByText } = render(
      <CustomerRootNavigation
        linkingPort={new LinkingPortStub(`vastra-merchant://order/${ORDER_ID}`)}
        slots={createSlots()}
      />,
    );

    expect(await findByText('This link belongs to another Vastra application.')).toBeTruthy();
  });
});
