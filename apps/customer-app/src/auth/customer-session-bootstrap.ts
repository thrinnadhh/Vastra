import type { CustomerLaunchStore } from './customer-launch-store';
import type { SessionRestorationState, SessionRestorer } from './session-restoration.types';

export type CustomerBootstrapState =
  | { readonly status: 'BOOTSTRAPPING' }
  | { readonly status: 'WELCOME'; readonly session: SessionRestorationState }
  | { readonly status: 'READY'; readonly session: SessionRestorationState }
  | { readonly status: 'UNAVAILABLE' };

export async function bootstrapCustomerSession(
  launchStore: CustomerLaunchStore,
  sessionRestorer: SessionRestorer,
): Promise<CustomerBootstrapState> {
  try {
    const [welcomeCompleted, session] = await Promise.all([
      launchStore.hasCompletedWelcome(),
      sessionRestorer.restore(),
    ]);

    if (!welcomeCompleted && session.status === 'SIGNED_OUT') {
      return { status: 'WELCOME', session };
    }

    return { status: 'READY', session };
  } catch {
    return { status: 'UNAVAILABLE' };
  }
}
