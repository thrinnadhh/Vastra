import { describe, expect, it, vi } from 'vitest';

import {
  installConnectivityAdapter,
  installMobileFocusAdapter,
  installWebFocusAdapter,
  type ConnectivityPort,
  type ConnectivityStatus,
  type FocusSourcePort,
  type OnlineManagerPort,
  type QueryFocusManagerPort,
} from '../src/index';

class FocusSource implements FocusSourcePort {
  private listener: ((focused: boolean) => void) | null = null;

  public constructor(private focused: boolean) {}

  public getCurrentFocus(): boolean {
    return this.focused;
  }

  public subscribe(listener: (focused: boolean) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  public emit(focused: boolean): void {
    this.focused = focused;
    this.listener?.(focused);
  }
}

class ConnectivitySource implements ConnectivityPort {
  private listener: ((status: ConnectivityStatus) => void) | null = null;

  public constructor(private status: ConnectivityStatus) {}

  public getCurrentStatus(): Promise<ConnectivityStatus> {
    return Promise.resolve(this.status);
  }

  public subscribe(listener: (status: ConnectivityStatus) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  public emit(status: ConnectivityStatus): void {
    this.status = status;
    this.listener?.(status);
  }
}

describe('focus and connectivity adapters', () => {
  it.each([installMobileFocusAdapter, installWebFocusAdapter])(
    'maps platform focus without importing platform runtime modules',
    (install) => {
      const source = new FocusSource(false);
      let cleanup: () => void = () => undefined;
      const setFocused = vi.fn();
      const manager: QueryFocusManagerPort = {
        setEventListener: (setup) => {
          cleanup = setup(setFocused);
        },
      };

      install(source, manager);
      source.emit(true);
      cleanup();
      source.emit(false);

      expect(setFocused.mock.calls).toEqual([[false], [true]]);
    },
  );

  it('maps online/offline and leaves unknown connectivity unspecified', async () => {
    const source = new ConnectivitySource('UNKNOWN');
    let cleanup: () => void = () => undefined;
    const setOnline = vi.fn();
    const manager: OnlineManagerPort = {
      setEventListener: (setup) => {
        cleanup = setup(setOnline);
      },
    };

    installConnectivityAdapter(source, manager);
    await Promise.resolve();
    source.emit('OFFLINE');
    source.emit('ONLINE');
    cleanup();
    source.emit('OFFLINE');

    expect(setOnline.mock.calls).toEqual([[false], [true]]);
  });
});
