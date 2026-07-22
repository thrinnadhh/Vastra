import { Linking } from 'react-native';

export interface CustomerLinkingPort {
  getInitialUrl(): Promise<string | null>;
  subscribe(listener: (url: string) => void): () => void;
}

export class ReactNativeCustomerLinkingPort implements CustomerLinkingPort {
  public getInitialUrl(): Promise<string | null> {
    return Linking.getInitialURL();
  }

  public subscribe(listener: (url: string) => void): () => void {
    const subscription = Linking.addEventListener('url', (event) => listener(event.url));
    return () => subscription.remove();
  }
}
