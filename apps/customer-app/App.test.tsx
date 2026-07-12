import { render } from '@testing-library/react-native';

import { CustomerFoundationScreen } from './App';

describe('CustomerFoundationScreen', () => {
  it('renders the accessible customer foundation screen', () => {
    const { getByLabelText, getByRole, getByText } = render(<CustomerFoundationScreen />);

    expect(getByRole('header', { name: 'Vastra' })).toBeTruthy();

    expect(getByText('A calm foundation for discovering fashion.')).toBeTruthy();

    expect(getByLabelText('Customer mobile foundation is ready')).toBeTruthy();
  });
});
