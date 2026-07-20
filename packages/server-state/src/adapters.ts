import { focusManager, onlineManager } from '@tanstack/react-query';

import type { ConnectivityPort, ConnectivityStatus } from './connectivity';

export interface FocusSourcePort {
  getCurrentFocus(): boolean;
  subscribe(listener: (focused: boolean) => void): () => void;
}

export interface QueryFocusManagerPort {
  setEventListener(setup: (setFocused: (focused?: boolean) => void) => () => void): void;
}

export interface OnlineManagerPort {
  setEventListener(setup: (setOnline: (online: boolean) => void) => () => void): void;
}

function installFocusAdapter(source: FocusSourcePort, manager: QueryFocusManagerPort): void {
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

function toOnlineValue(status: ConnectivityStatus): boolean | null {
  if (status === 'ONLINE') return true;
  if (status === 'OFFLINE') return false;
  return null;
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
      const online = toOnlineValue(status);
      if (online !== null) setOnline(online);
    });
    void source
      .getCurrentStatus()
      .then((status) => {
        const online = toOnlineValue(status);
        if (active && !emitted && online !== null) setOnline(online);
      })
      .catch(() => {
        // A failed connectivity probe is UNKNOWN, so TanStack keeps its current state.
      });
    return () => {
      active = false;
      unsubscribe();
    };
  });
}
