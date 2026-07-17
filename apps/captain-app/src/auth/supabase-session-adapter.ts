import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type AuthChangeEvent, type Session } from '@supabase/supabase-js';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import 'react-native-url-polyfill/auto';

import type { CaptainMobileEnvironment } from './mobile-environment';
import type {
  AuthSessionEvent,
  AuthSessionPort,
  RestorableSession,
} from './session-restoration.types';

function mapSession(session: Session | null): RestorableSession | null {
  if (session === null) {
    return null;
  }

  if (
    typeof session.user.id !== 'string' ||
    session.user.id.length === 0 ||
    typeof session.access_token !== 'string' ||
    session.access_token.length === 0
  ) {
    throw new TypeError('Supabase returned an invalid session');
  }

  return {
    userId: session.user.id,
    accessToken: session.access_token,
  };
}

function mapAuthEvent(event: AuthChangeEvent): AuthSessionEvent {
  switch (event) {
    case 'INITIAL_SESSION':
    case 'SIGNED_IN':
    case 'SIGNED_OUT':
    case 'TOKEN_REFRESHED':
    case 'USER_UPDATED':
    case 'PASSWORD_RECOVERY':
    case 'MFA_CHALLENGE_VERIFIED':
      return event;

    default:
      return 'UNKNOWN';
  }
}

export function createCaptainSupabaseClient(environment: CaptainMobileEnvironment) {
  return createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
    auth: {
      ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export type CaptainSupabaseClient = ReturnType<typeof createCaptainSupabaseClient>;

export class SupabaseAuthSessionAdapter implements AuthSessionPort {
  public constructor(private readonly client: CaptainSupabaseClient) {}

  public async getSession(): Promise<RestorableSession | null> {
    const response = await this.client.auth.getSession();

    if (response.error !== null) {
      throw response.error;
    }

    return mapSession(response.data.session);
  }

  public onSessionChange(
    listener: (event: AuthSessionEvent, session: RestorableSession | null) => void,
  ): () => void {
    const {
      data: { subscription },
    } = this.client.auth.onAuthStateChange((event, session) => {
      listener(mapAuthEvent(event), mapSession(session));
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  public async signOutLocal(): Promise<void> {
    const response = await this.client.auth.signOut({
      scope: 'local',
    });

    if (response.error !== null) {
      throw response.error;
    }
  }
}

function updateAutoRefresh(client: CaptainSupabaseClient, state: AppStateStatus): void {
  if (state === 'active') {
    void client.auth.startAutoRefresh();
    return;
  }

  void client.auth.stopAutoRefresh();
}

export function startSupabaseAuthLifecycle(client: CaptainSupabaseClient): () => void {
  if (Platform.OS === 'web') {
    return () => undefined;
  }

  updateAutoRefresh(client, AppState.currentState);

  const subscription = AppState.addEventListener('change', (state) => {
    updateAutoRefresh(client, state);
  });

  return () => {
    subscription.remove();
    void client.auth.stopAutoRefresh();
  };
}
