import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CustomerProfilePreferencesScreen } from './customer-profile-preferences.screen';
import type { CustomerPreferencesPort } from './customer-profile-preferences.types';

function createPort(): CustomerPreferencesPort & { save: jest.Mock } {
  return {
    load: jest.fn().mockResolvedValue({
      genderCategories: [],
      preferredColours: [],
      preferredSizes: [],
      minPricePaise: null,
      maxPricePaise: null,
    }),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

describe('CustomerProfilePreferencesScreen', () => {
  it('shows server-owned identity and allows skipping optional preferences', async () => {
    const onContinue = jest.fn();
    const screen = render(
      <CustomerProfilePreferencesScreen
        identity={{ fullName: 'Trinadh', phoneNumberMasked: '+91••••••3210' }}
        onContinue={onContinue}
        preferencesPort={createPort()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Trinadh · +91••••••3210')).toBeTruthy());
    fireEvent.press(screen.getByText('Skip for now'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('saves selected optional preferences and integer-paise budget', async () => {
    const port = createPort();
    const onContinue = jest.fn();
    const screen = render(
      <CustomerProfilePreferencesScreen
        identity={{ fullName: null, phoneNumberMasked: '+91••••••3210' }}
        onContinue={onContinue}
        preferencesPort={port}
      />,
    );

    await waitFor(() => expect(screen.getByText('WOMEN')).toBeTruthy());
    fireEvent.press(screen.getByText('WOMEN'));
    fireEvent.changeText(screen.getByLabelText('Minimum budget in rupees'), '500');
    fireEvent.changeText(screen.getByLabelText('Maximum budget in rupees'), '2000');
    fireEvent.press(screen.getByText('Save and continue'));

    await waitFor(() => expect(port.save).toHaveBeenCalledWith(expect.objectContaining({
      genderCategories: ['WOMEN'],
      minPricePaise: 50000,
      maxPricePaise: 200000,
    })));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
