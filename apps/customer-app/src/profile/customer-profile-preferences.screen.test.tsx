import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CustomerProfilePreferencesScreen } from './customer-profile-preferences.screen';
import type {
  CustomerPreferenceSnapshot,
  CustomerPreferencesPort,
} from './customer-profile-preferences.types';

const EMPTY_PREFERENCES: CustomerPreferenceSnapshot = {
  genderCategories: [],
  styleTags: ['casual'],
  occasionTags: ['work'],
  preferredColours: ['#112233'],
  preferredSizes: [],
  minPricePaise: null,
  maxPricePaise: null,
  updatedAt: null,
};

function createPort(): CustomerPreferencesPort & { readonly save: jest.Mock } {
  return {
    load: jest.fn().mockResolvedValue({ kind: 'READY', preferences: EMPTY_PREFERENCES }),
    save: jest.fn().mockResolvedValue({ kind: 'SAVED', preferences: EMPTY_PREFERENCES }),
  };
}

describe('CustomerProfilePreferencesScreen', () => {
  it('shows server-owned identity and allows skipping optional preferences', async () => {
    const onContinue = jest.fn();
    const screen = render(
      <CustomerProfilePreferencesScreen
        identity={{ fullName: 'Trinadh' }}
        onContinue={onContinue}
        preferencesPort={createPort()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Trinadh')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Skip for now'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('does not fabricate profile persistence when the update contract is absent', async () => {
    const screen = render(
      <CustomerProfilePreferencesScreen
        identity={{ fullName: null }}
        onContinue={jest.fn()}
        preferencesPort={createPort()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Name editing is not available until Vastra exposes/u)).toBeTruthy();
    });
  });

  it('saves selected categories, sizes and integer-paise budgets once', async () => {
    const port = createPort();
    const onContinue = jest.fn();
    const screen = render(
      <CustomerProfilePreferencesScreen
        identity={{ fullName: null }}
        onContinue={onContinue}
        preferencesPort={port}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('WOMEN')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('WOMEN'));
    fireEvent.changeText(screen.getByLabelText('Preferred sizes'), 'm, L, m');
    fireEvent.changeText(screen.getByLabelText('Minimum budget in rupees'), '500');
    fireEvent.changeText(screen.getByLabelText('Maximum budget in rupees'), '2000.50');
    fireEvent.press(screen.getByText('Save and continue'));
    fireEvent.press(screen.getByText('Saving…'));

    await waitFor(() => {
      expect(port.save).toHaveBeenCalledWith({
        genderCategories: ['WOMEN'],
        styleTags: ['casual'],
        occasionTags: ['work'],
        preferredColours: ['#112233'],
        preferredSizes: ['M', 'L'],
        minPricePaise: 50_000,
        maxPricePaise: 200_050,
      });
    });
    expect(port.save).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('retains the screen when the server cannot save preferences', async () => {
    const port = createPort();
    port.save.mockResolvedValue({ kind: 'UNAVAILABLE' });
    const screen = render(
      <CustomerProfilePreferencesScreen
        identity={{ fullName: 'Trinadh' }}
        onContinue={jest.fn()}
        preferencesPort={port}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Save and continue')).toBeTruthy();
    });
    fireEvent.press(screen.getByText('Save and continue'));

    await waitFor(() => {
      expect(
        screen.getByText('Preferences were not saved. Try again or skip for now.'),
      ).toBeTruthy();
    });
  });
});
