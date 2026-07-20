import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MerchantSessionApp } from './default-merchant-session';

interface TestSession {
  readonly access_token: string;
  readonly user: { readonly id: string };
}

type AuthListener = (event: string, session: TestSession | null) => void;

const mockCreateClient = jest.fn<unknown, [string, string, unknown]>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (url: string, key: string, options: unknown) => mockCreateClient(url, key, options),
}));

const SESSION: TestSession = {
  access_token: 'merchant-access-token',
  user: { id: '10000000-0000-4000-8000-000000000001' },
};

function response(status: number, data: unknown = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

describe('MerchantSessionApp preservation', () => {
  let authListener: AuthListener | undefined;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  const unsubscribe = jest.fn();
  const startAutoRefresh = jest.fn(() => Promise.resolve());
  const stopAutoRefresh = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    Object.assign(process.env, {
      EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test/v1',
      EXPO_PUBLIC_SUPABASE_URL: 'https://supabase.example.test',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key-value',
    });
    authListener = undefined;
    unsubscribe.mockClear();
    startAutoRefresh.mockClear();
    stopAutoRefresh.mockClear();

    mockCreateClient.mockReturnValue({
      auth: {
        getSession: jest.fn(() => Promise.resolve({ data: { session: SESSION }, error: null })),
        onAuthStateChange: jest.fn((listener: AuthListener) => {
          authListener = listener;
          return { data: { subscription: { unsubscribe } } };
        }),
        startAutoRefresh,
        stopAutoRefresh,
      },
    });
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('restores a verified merchant and renders authenticated content', async () => {
    fetchSpy.mockResolvedValue(
      response(200, {
        success: true,
        data: { id: SESSION.user.id, accountType: 'MERCHANT', status: 'ACTIVE' },
      }),
    );
    const view = render(
      <MerchantSessionApp>
        <Text>Authenticated merchant orders</Text>
      </MerchantSessionApp>,
    );

    expect(view.getByLabelText('Restoring merchant session')).toBeTruthy();
    expect(await view.findByText('Authenticated merchant orders')).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledWith('https://api.example.test/v1/me', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${SESSION.access_token}`,
      },
    });
  });

  it('removes protected content immediately after sign-out', async () => {
    fetchSpy.mockResolvedValue(
      response(200, {
        success: true,
        data: { id: SESSION.user.id, accountType: 'MERCHANT', status: 'ACTIVE' },
      }),
    );
    const view = render(
      <MerchantSessionApp>
        <Text>Authenticated merchant orders</Text>
      </MerchantSessionApp>,
    );
    expect(await view.findByText('Authenticated merchant orders')).toBeTruthy();

    act(() => {
      authListener?.('SIGNED_OUT', null);
    });

    expect(await view.findByText('Sign in to continue')).toBeTruthy();
    expect(view.queryByText('Authenticated merchant orders')).toBeNull();
  });

  it('preserves the session and retries a recoverable account check', async () => {
    fetchSpy.mockResolvedValueOnce(response(503)).mockResolvedValueOnce(
      response(200, {
        success: true,
        data: { id: SESSION.user.id, accountType: 'MERCHANT', status: 'ACTIVE' },
      }),
    );
    const view = render(
      <MerchantSessionApp>
        <Text>Authenticated merchant orders</Text>
      </MerchantSessionApp>,
    );
    expect(await view.findByText('Session check unavailable')).toBeTruthy();

    fireEvent.press(view.getByLabelText('Retry merchant session restoration'));

    expect(await view.findByText('Authenticated merchant orders')).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
