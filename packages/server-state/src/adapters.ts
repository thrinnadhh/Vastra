import { focusManager, onlineManager } from '@tanstack/react-query';

import type { ConnectivityPort, ConnectivityStatus } from './connectivity';

export interface FocusSourcePort {
  getCurrentFocus(): boolean;
  subscribe(listener: (focused: boolean) => void): () => void;
}

export interface QueryFocusManagerPort {
  setEventListener(
    setup: (setFocused: (focused?: boolean) => void) => () => void,
  ): void;
}

export interface OnlineManagerPort {
  setEventListener(setup: (setOnline: (online?: boolean) => void) => () => void): void;
}

function installFocusAdapter(
  source: FocusSourcePort,
  manager: QueryFocusManagerPort,
): void {
  manager.setEventListener((setFocused) => {
    setFocused(source.getCurrentFocus());
    return source.subscribe(setFocused);
  });
}

export function installMobileFocusAdapter(
  source: FocusSourcePort,
  manager: QueryFocusManagerPort = focusManager,
): void {
  installFocusAdapter(source, manager);
}

export function installWebFocusAdapter(
  source: FocusSourcePort,
  manager: QueryFocusManagerPort = focusManager,
): void {
  installFocusAdapter(source, manager);
}

function toOnlineValue(status: ConnectivityStatus): boolean | undefined {
  if (status === 'ONLINE') return true;
  if (status === 'OFFLINE') return false;
  return undefined;
}

export function installConnectivityAdapter(
  source: ConnectivityPort,
  manager: OnlineManagerPort = onlineManager,
): void {
  manager.setEventListener((setOnline) => {
    let active = true;
    let emitted = false;
    const unsubscribe = source.subscribe((status) => {
      emitted = true;
      setOnline(toOnlineValue(status));
    });
    void source
      .getCurrentStatus()
      .then((status) => {
        if (active && !emitted) setOnline(toOnlineValue(status));
      })
      .catch(() => {
        if (active && !emitted) setOnline(undefined);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  });
}
