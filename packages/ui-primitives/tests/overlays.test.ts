import { describe, expect, it } from 'vitest';

import {
  createDialogPrimitive,
  createErrorStatePrimitive,
  createSheetPrimitive,
} from '../src/index.js';

const retryAction = {
  id: 'retry',
  label: 'Try again',
  accessibilityLabel: 'Try loading again',
} as const;

describe('overlays and error states', () => {
  it('requires a recovery action for recoverable errors', () => {
    expect(() =>
      createErrorStatePrimitive({
        id: 'catalogue-error',
        kind: 'recoverable',
        title: 'Could not load products',
        message: 'Check your connection and try again.',
      }),
    ).toThrow('Recoverable error states require a primary recovery action');

    const state = createErrorStatePrimitive({
      id: 'catalogue-error',
      kind: 'recoverable',
      title: 'Could not load products',
      message: 'Check your connection and try again.',
      primaryAction: retryAction,
    });
    expect(state.live).toBe('polite');
    expect(state.primaryAction).toEqual(retryAction);
  });

  it('requires an explicit close path for dismissible sheets', () => {
    expect(() => createSheetPrimitive({ id: 'filters', open: true, title: 'Filters' })).toThrow(
      'Dismissible sheets require a close label',
    );

    const sheet = createSheetPrimitive({
      id: 'filters',
      open: true,
      title: 'Filters',
      closeLabel: 'Close filters',
      snapPoints: [1, 0.5, 1],
    });
    expect(sheet.snapPoints).toEqual([0.5, 1]);
    expect(sheet.trapFocusOnWeb).toBe(true);
  });

  it('uses alertdialog semantics for destructive confirmation', () => {
    const dialog = createDialogPrimitive({
      id: 'cancel-order',
      open: true,
      title: 'Cancel order?',
      description: 'This action cannot be undone.',
      tone: 'destructive',
      dismissible: false,
      confirmAction: {
        id: 'confirm-cancel',
        label: 'Cancel order',
        accessibilityLabel: 'Confirm order cancellation',
      },
      cancelAction: {
        id: 'keep-order',
        label: 'Keep order',
        accessibilityLabel: 'Keep the order',
      },
    });

    expect(dialog.role).toBe('alertdialog');
    expect(dialog.dismissible).toBe(false);
    expect(dialog.restoreFocus).toBe(true);
  });
});
