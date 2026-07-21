import AsyncStorage from '@react-native-async-storage/async-storage';

const WELCOME_COMPLETED_KEY = '@vastra/customer/welcome-completed/v1';

export interface CustomerLaunchStore {
  hasCompletedWelcome(): Promise<boolean>;
  markWelcomeCompleted(): Promise<void>;
}

export class AsyncStorageCustomerLaunchStore implements CustomerLaunchStore {
  public async hasCompletedWelcome(): Promise<boolean> {
    return (await AsyncStorage.getItem(WELCOME_COMPLETED_KEY)) === 'true';
  }

  public async markWelcomeCompleted(): Promise<void> {
    await AsyncStorage.setItem(WELCOME_COMPLETED_KEY, 'true');
  }
}

export const RETURNING_CUSTOMER_LAUNCH_STORE: CustomerLaunchStore = Object.freeze({
  hasCompletedWelcome: () => Promise.resolve(true),
  markWelcomeCompleted: () => Promise.resolve(),
});
