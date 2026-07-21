import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CustomerPhoneOtpScreen } from './customer-phone-otp.screen';
import { PhoneOtpError, type PhoneOtpPort } from './phone-otp.types';

class PhoneOtpPortStub implements PhoneOtpPort {
  public requestedPhones: string[] = [];
  public verifiedCodes: Array<{ readonly phone: string; readonly code: string }> = [];
  public requestError: PhoneOtpError | null = null;
  public verifyError: PhoneOtpError | null = null;

  public requestOtp(phoneE164: string): Promise<void> {
    this.requestedPhones.push(phoneE164);
    return this.requestError === null ? Promise.resolve() : Promise.reject(this.requestError);
  }

  public verifyOtp(phoneE164: string, code: string): Promise<void> {
    this.verifiedCodes.push({ phone: phoneE164, code });
    return this.verifyError === null ? Promise.resolve() : Promise.reject(this.verifyError);
  }
}

describe('CustomerPhoneOtpScreen', () => {
  it('validates and requests a code before showing the OTP step', async () => {
    const otpPort = new PhoneOtpPortStub();
    const { findByText, getByLabelText, getByRole } = render(
      <CustomerPhoneOtpScreen otpPort={otpPort} />,
    );

    fireEvent.changeText(getByLabelText('Mobile number'), '98765 43210');
    fireEvent.press(getByRole('button', { name: 'Send secure code' }));

    expect(await findByText('Enter your secure code')).toBeTruthy();
    expect(otpPort.requestedPhones).toEqual(['+919876543210']);
    expect(getByRole('button', { name: 'Resend secure code' }).props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(await findByText('Resend available in 30 seconds')).toBeTruthy();
  });

  it('does not call Supabase for an invalid phone number', async () => {
    const otpPort = new PhoneOtpPortStub();
    const { findByText, getByLabelText, getByRole } = render(
      <CustomerPhoneOtpScreen otpPort={otpPort} />,
    );

    fireEvent.changeText(getByLabelText('Mobile number'), '123');
    fireEvent.press(getByRole('button', { name: 'Send secure code' }));

    expect(await findByText('Enter a valid 10-digit Indian mobile number.')).toBeTruthy();
    expect(otpPort.requestedPhones).toEqual([]);
  });

  it('verifies a six-digit code and waits for session restoration', async () => {
    const otpPort = new PhoneOtpPortStub();
    const { findByText, getByLabelText, getByRole } = render(
      <CustomerPhoneOtpScreen otpPort={otpPort} />,
    );

    fireEvent.changeText(getByLabelText('Mobile number'), '9876543210');
    fireEvent.press(getByRole('button', { name: 'Send secure code' }));
    await findByText('Enter your secure code');

    fireEvent.changeText(getByLabelText('One-time code'), '123456');
    fireEvent.press(getByRole('button', { name: 'Verify secure code' }));

    expect(await findByText('Code accepted')).toBeTruthy();
    expect(otpPort.verifiedCodes).toEqual([{ phone: '+919876543210', code: '123456' }]);
  });

  it('shows expired-code recovery without clearing the entered code', async () => {
    const otpPort = new PhoneOtpPortStub();
    otpPort.verifyError = new PhoneOtpError('EXPIRED');
    const { findByText, getByLabelText, getByRole } = render(
      <CustomerPhoneOtpScreen otpPort={otpPort} />,
    );

    fireEvent.changeText(getByLabelText('Mobile number'), '9876543210');
    fireEvent.press(getByRole('button', { name: 'Send secure code' }));
    await findByText('Enter your secure code');

    fireEvent.changeText(getByLabelText('One-time code'), '654321');
    fireEvent.press(getByRole('button', { name: 'Verify secure code' }));

    expect(
      await findByText('That code has expired. Request a new code and try again.'),
    ).toBeTruthy();
    await waitFor(() => {
      expect(getByLabelText('One-time code').props.value).toBe('654321');
    });
  });
});
