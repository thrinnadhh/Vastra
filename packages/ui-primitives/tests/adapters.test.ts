import { describe, expect, it } from 'vitest';

import {
  createButtonPrimitive,
  createDialogPrimitive,
  createFieldPrimitive,
  createIconPrimitive,
  createStatusBadgePrimitive,
  toNativeButtonProps,
  toNativeFieldProps,
  toWebButtonProps,
  toWebDialogProps,
  toWebFieldProps,
  toWebIconProps,
  toWebStatusProps,
} from '../src/index.js';

describe('platform adapters', () => {
  it('maps button state to web and native accessibility props', () => {
    const button = createButtonPrimitive({
      id: 'submit-otp',
      label: 'Verify code',
      accessibilityHint: 'Submits the one-time code',
      busy: true,
      expanded: false,
    });

    expect(toWebButtonProps(button)).toEqual(
      expect.objectContaining({
        disabled: true,
        tabIndex: -1,
        'aria-busy': true,
        'aria-expanded': false,
      }),
    );
    expect(toNativeButtonProps(button)).toEqual(
      expect.objectContaining({
        disabled: true,
        accessibilityLabel: 'Verify code',
        minimumTouchSize: { android: 48, ios: 44 },
      }),
    );
  });

  it('maps field labels, descriptions, and invalid state on both platforms', () => {
    const field = createFieldPrimitive({
      id: 'otp',
      label: 'One-time code',
      value: '123',
      error: 'Enter the six-digit code.',
      autoComplete: 'one-time-code',
      inputMode: 'numeric',
    });

    expect(toWebFieldProps(field)).toEqual(
      expect.objectContaining({
        'aria-labelledby': 'otp-label',
        'aria-describedby': 'otp-error',
        'aria-invalid': true,
        'aria-errormessage': 'otp-error',
      }),
    );
    expect(toNativeFieldProps(field)).toEqual(
      expect.objectContaining({
        editable: true,
        accessibilityInvalid: true,
        accessibilityHint: 'Enter the six-digit code.',
      }),
    );
  });

  it('keeps status and icon meaning available to assistive technology', () => {
    const status = createStatusBadgePrimitive({ label: 'Delivered', tone: 'success' });
    const icon = createIconPrimitive({ name: 'check', label: 'Verified' });

    expect(toWebStatusProps(status)).toEqual({
      role: 'status',
      'aria-label': 'Delivered',
      'data-tone': 'success',
    });
    expect(toWebIconProps(icon)).toEqual({
      'aria-hidden': false,
      'aria-label': 'Verified',
      role: 'img',
    });
  });

  it('maps destructive dialogs to modal alertdialog semantics', () => {
    const dialog = createDialogPrimitive({
      id: 'reject-order',
      open: true,
      title: 'Reject order?',
      description: 'The customer will be informed.',
      tone: 'destructive',
      confirmAction: {
        id: 'reject',
        label: 'Reject',
        accessibilityLabel: 'Reject this order',
      },
      cancelAction: {
        id: 'cancel',
        label: 'Go back',
        accessibilityLabel: 'Return without rejecting',
      },
    });

    expect(toWebDialogProps(dialog)).toEqual({
      id: 'reject-order',
      role: 'alertdialog',
      'aria-modal': true,
      'aria-label': 'Reject order?',
      hidden: false,
    });
  });
});
