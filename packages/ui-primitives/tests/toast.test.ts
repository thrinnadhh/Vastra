import { describe, expect, it, vi } from 'vitest';

import { createToastPrimitive, createToastStore } from '../src/index.js';

describe('toast primitives', () => {
  it('bounds transient duration and uses assertive announcements only for danger', () => {
    expect(
      createToastPrimitive({ id: 'saved', message: 'Saved', durationMs: 250 }).durationMs,
    ).toBe(2_000);
    expect(
      createToastPrimitive({ id: 'failed', message: 'Could not save', tone: 'danger' }).live,
    ).toBe('assertive');
    expect(
      createToastPrimitive({ id: 'persistent', message: 'Offline', durationMs: null })
        .durationMs,
    ).toBeNull();
  });

  it('deduplicates by stable id and enforces the visible queue limit', () => {
    const store = createToastStore(2);
    store.push({ id: 'one', message: 'One' });
    store.push({ id: 'two', message: 'Two' });
    store.push({ id: 'one', message: 'One updated', tone: 'success' });

    expect(store.getSnapshot().map((toast) => toast.id)).toEqual(['two', 'one']);
    expect(store.getSnapshot()[1]?.message).toBe('One updated');
  });

  it('notifies subscribers only when the queue changes', () => {
    const store = createToastStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.push({ id: 'notice', message: 'Order updated' });
    store.dismiss('missing');
    store.dismiss('notice');
    store.clear();
    unsubscribe();
    store.push({ id: 'after', message: 'After unsubscribe' });

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
