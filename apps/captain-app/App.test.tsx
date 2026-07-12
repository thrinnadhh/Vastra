import { render } from '@testing-library/react-native';

import { CaptainFoundationScreen } from './App';

describe('CaptainFoundationScreen', () => {
  it('renders the accessible captain foundation screen', () => {
    const { getByLabelText, getByRole, getByText } = render(<CaptainFoundationScreen />);

    expect(getByRole('header', { name: 'Vastra Captain' })).toBeTruthy();

    expect(getByText('A dependable foundation for local delivery operations.')).toBeTruthy();

    expect(getByLabelText('Captain mobile foundation is ready')).toBeTruthy();
  });
});
