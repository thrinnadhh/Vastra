import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CustomerLaunchStore } from './customer-launch-store';

const WELCOME_COMPLETED_KEY = '@vastra/customer/welcome-completed/v1';

export class AsyncStorageCustomerLaunchStore implements CustomerLaunchStore {
  public async hasCompletedWelcome(): Promise<boolean> {
    return (await AsyncStorage.getItem(WELCOME_COMPLETED_KEY)) === 'true';
  }

  public async markWelcomeCompleted(): Promise<void> {
    await AsyncStorage.setItem(WELCOME_COMPLETED_KEY, 'true');
  }
}
