import { describe, expect, it } from 'vitest';

import { createAdminShellContract, createMobileShellContract } from '../src/contracts.js';

describe('createMobileShellContract', () => {
  it('defines safe-area, keyboard, and overlay ordering defaults', () => {
    const shell = createMobileShellContract({ role: 'customer' });

    expect(shell.safeAreaEdges).toEqual(['top', 'right', 'bottom', 'left']);
    expect(shell.keyboardAware).toBe(true);
    expect(shell.keyboardShouldPersistTaps).toBe('handled');
    expect(shell.overlayAfterContent).toBe(true);
    expect(shell.scrollable).toBe(false);
  });

  it('keeps merchant and captain shells operational Commerce surfaces', () => {
    expect(createMobileShellContract({ role: 'merchant' }).mode).toBe('commerce');
    expect(() => createMobileShellContract({ role: 'captain', mode: 'brand' })).toThrow(
      'Merchant and captain application shells must use Commerce mode',
    );
  });

  it('allows customer Hybrid and Brand shell contracts without changing navigation', () => {
    expect(createMobileShellContract({ role: 'customer', mode: 'hybrid' }).mode).toBe('hybrid');
    expect(createMobileShellContract({ role: 'customer', mode: 'brand' }).mode).toBe('brand');
  });
});

describe('createAdminShellContract', () => {
  it('creates skip-link, navigation, and main-content ownership', () => {
    const shell = createAdminShellContract({
      productLabel: 'Vastra Admin',
      navigation: [{ href: '/', label: 'Overview', current: true }],
    });

    expect(shell.skipLinkHref).toBe('#admin-main-content');
    expect(shell.navigationLabel).toBe('Admin navigation');
    expect(shell.navigation[0]).toEqual({ href: '/', label: 'Overview', current: true });
  });

  it('rejects ambiguous or unsafe navigation contracts', () => {
    expect(() =>
      createAdminShellContract({ productLabel: 'Vastra Admin', navigation: [] }),
    ).toThrow('Admin application shell requires at least one navigation item');

    expect(() =>
      createAdminShellContract({
        productLabel: 'Vastra Admin',
        navigation: [
          { href: '/', label: 'Overview' },
          { href: '/', label: 'Duplicate' },
        ],
      }),
    ).toThrow('Duplicate admin navigation href: /');

    expect(() =>
      createAdminShellContract({
        productLabel: 'Vastra Admin',
        navigation: [
          { href: '/', label: 'Overview', current: true },
          { href: '/orders', label: 'Orders', current: true },
        ],
      }),
    ).toThrow('Admin application shell allows at most one current navigation item');
  });
});
