import { fireEvent, render } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';

jest.mock('./delivery/hardened-captain-delivery.screen', () => ({
  HardenedAuthenticatedCaptainDeliveryScreen: () => <MockText>Captain delivery work</MockText>,
}));

jest.mock('./presence/hardened-captain-presence.screen', () => ({
  HardenedAuthenticatedCaptainPresenceScreen: () => <MockText>Captain availability work</MockText>,
}));

import { CaptainOperationsScreen } from './captain-operations.screen';

describe('CaptainOperationsScreen', () => {
  it('provides explicit accessible delivery and availability sections', () => {
    const view = render(<CaptainOperationsScreen />);

    expect(view.getByLabelText('Deliveries tab').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(view.getByText('Captain delivery work')).toBeTruthy();

    fireEvent.press(view.getByLabelText('Availability tab'));

    expect(view.getByLabelText('Availability tab').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(view.getByText('Captain availability work')).toBeTruthy();
  });
});
