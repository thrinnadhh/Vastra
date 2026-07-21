export interface CustomerLaunchStore {
  hasCompletedWelcome(): Promise<boolean>;
  markWelcomeCompleted(): Promise<void>;
}

export const RETURNING_CUSTOMER_LAUNCH_STORE: CustomerLaunchStore = Object.freeze({
  hasCompletedWelcome: () => Promise.resolve(true),
  markWelcomeCompleted: () => Promise.resolve(),
});
