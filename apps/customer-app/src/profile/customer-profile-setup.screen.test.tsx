import { fireEvent, render } from '@testing-library/react-native';

import { CustomerProfileSetupScreen } from './customer-profile-setup.screen';
import type {
  CustomerProfileSetupPort,
  CustomerProfileSetupResult,
} from './customer-profile-setup.types';

class ProfileSetupPortStub implements CustomerProfileSetupPort {
  public names: string[] = [];
  public result: CustomerProfileSetupResult = { kind: 'SAVED', fullName: 'Trinadh B' };

  public save(fullName: string): Promise<CustomerProfileSetupResult> {
    this.names.push(fullName);
    return Promise.resolve(this.result);
  }
}

describe('CustomerProfileSetupScreen', () => {
  it('normalizes and saves the required customer name', async () => {
    const profilePort = new ProfileSetupPortStub();
    const completed: string[] = [];
    const { findByText, getByLabelText, getByRole } = render(
      <CustomerProfileSetupScreen
        onCompleted={(fullName) => completed.push(fullName)}
        profilePort={profilePort}
      />,
    );

    fireEvent.changeText(getByLabelText('Full name'), '  Trinadh   B ');
    fireEvent.press(getByRole('button', { name: 'Save customer profile' }));

    await findByText('Complete your profile');
    expect(profilePort.names).toStrictEqual(['Trinadh B']);
    expect(completed).toStrictEqual(['Trinadh B']);
  });

  it('rejects invalid input without contacting the server', async () => {
    const profilePort = new ProfileSetupPortStub();
    const { findByText, getByLabelText, getByRole } = render(
      <CustomerProfileSetupScreen onCompleted={() => undefined} profilePort={profilePort} />,
    );

    fireEvent.changeText(getByLabelText('Full name'), ' ');
    fireEvent.press(getByRole('button', { name: 'Save customer profile' }));

    expect(await findByText('Enter your name using 2 to 120 characters.')).toBeTruthy();
    expect(profilePort.names).toStrictEqual([]);
  });

  it('keeps a recoverable error when the server is unavailable', async () => {
    const profilePort = new ProfileSetupPortStub();
    profilePort.result = { kind: 'UNAVAILABLE' };
    const { findByText, getByLabelText, getByRole } = render(
      <CustomerProfileSetupScreen onCompleted={() => undefined} profilePort={profilePort} />,
    );

    fireEvent.changeText(getByLabelText('Full name'), 'Trinadh B');
    fireEvent.press(getByRole('button', { name: 'Save customer profile' }));

    expect(
      await findByText('We could not save your profile. Check your connection and try again.'),
    ).toBeTruthy();
  });
});
