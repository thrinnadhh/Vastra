import { Linking } from 'react-native';

export interface CustomerLinkingPort {
  getInitialUrl(): Promise<string | null>;
  subscribe(listener: (url: string) => void): () => void;
}

export class ReactNativeCustomerLinkingPort implements CustomerLinkingPort {
  public async getInitialUrl(): Promise<string | null> {
    const initialUrl: unknown = await Linking.getInitialURL();
    return typeof initialUrl === 'string' ? initialUrl : null;
  }

  public subscribe(listener: (url: string) => void): () => void {
    const subscription = Linking.addEventListener('url', (event) => {
      listener(event.url);
    });
    return () => {
      subscription.remove();
    };
  }
}
