import { render } from '@testing-library/react-native';

import { MerchantFoundationScreen } from './App';

describe('MerchantFoundationScreen', () => {
  it('renders the accessible merchant foundation screen', () => {
    const { getByLabelText, getByRole, getByText } = render(<MerchantFoundationScreen />);

    expect(getByRole('header', { name: 'Vastra Merchant' })).toBeTruthy();

    expect(getByText('A focused foundation for managing local fashion operations.')).toBeTruthy();

    expect(getByLabelText('Merchant mobile foundation is ready')).toBeTruthy();
  });
});
