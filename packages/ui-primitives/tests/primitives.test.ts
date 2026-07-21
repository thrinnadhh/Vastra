import { describe, expect, it } from 'vitest';

import {
  MOBILE_TOUCH_TARGET,
  createButtonPrimitive,
  createCardPrimitive,
  createFieldPrimitive,
  createIconPrimitive,
  createPricePrimitive,
  createSkeletonPrimitive,
  createStatusBadgePrimitive,
} from '../src/index.js';

describe('shared primitive contracts', () => {
  it('blocks duplicate button activation while busy and preserves touch targets', () => {
    const button = createButtonPrimitive({
      id: 'place-order',
      label: 'Place order',
      busy: true,
      icon: 'check',
    });

    expect(button.disabled).toBe(true);
    expect(button.accessibility.state.busy).toBe(true);
    expect(button.minimumTouchTarget).toEqual(MOBILE_TOUCH_TARGET);
    expect(button.styleSlots).toContain('action.primary.surface');
  });

  it('links field descriptions and errors without discarding the current value', () => {
    const field = createFieldPrimitive({
      id: 'phone',
      label: 'Phone number',
      value: '9876543210',
      description: 'Use the number linked to your account.',
      error: 'Enter a valid mobile number.',
      inputMode: 'tel',
      autoComplete: 'tel',
      required: true,
    });

    expect(field.value).toBe('9876543210');
    expect(field.describedBy).toEqual(['phone-description', 'phone-error']);
    expect(field.accessibility.state.invalid).toBe(true);
    expect(field.styleSlots).toContain('border.error');
  });

  it('requires labels for meaningful icons and hides decorative icons', () => {
    expect(() => createIconPrimitive({ name: 'cart' })).toThrow(
      'Meaningful icons require an accessibility label',
    );
    expect(createIconPrimitive({ name: 'chevronRight', decorative: true })).toEqual({
      kind: 'icon',
      name: 'chevronRight',
      decorative: true,
      accessibilityLabel: null,
    });
  });

  it('pairs status text with a semantic icon instead of relying on colour', () => {
    const badge = createStatusBadgePrimitive({
      label: 'Packing',
      tone: 'warning',
      description: 'Merchant is preparing the order.',
    });

    expect(badge.icon.name).toBe('warning');
    expect(badge.icon.accessibilityLabel).toBe('Packing status');
    expect(badge.accessibilityLabel).toContain('Merchant is preparing the order');
  });

  it('formats integer paise and announces sale pricing truthfully', () => {
    const price = createPricePrimitive({
      amountPaise: 1_299_00,
      originalAmountPaise: 1_499_00,
    });

    expect(price.formatted).toContain('1,299');
    expect(price.discounted).toBe(true);
    expect(price.accessibilityLabel).toContain('reduced from');
    expect(() => createPricePrimitive({ amountPaise: 10.5 })).toThrow('integer number of paise');
  });

  it('requires explicit accessibility for interactive cards', () => {
    expect(() =>
      createCardPrimitive({ id: 'shop-card', title: 'Local shop', interactive: true }),
    ).toThrow('Interactive cards require an accessibility label');

    const card = createCardPrimitive({
      id: 'shop-card',
      title: 'Local shop',
      interactive: true,
      selected: true,
      accessibilityLabel: 'Open Local shop',
    });
    expect(card.variant).toBe('selected');
    expect(card.accessibility?.state.selected).toBe(true);
  });

  it('turns skeleton motion off when reduced motion is requested', () => {
    const skeleton = createSkeletonPrimitive({
      id: 'product-image-loading',
      shape: 'rectangle',
      width: 160,
      height: 200,
      reducedMotion: true,
    });

    expect(skeleton.animated).toBe(false);
    expect(skeleton.accessibilityHidden).toBe(true);
  });
});
