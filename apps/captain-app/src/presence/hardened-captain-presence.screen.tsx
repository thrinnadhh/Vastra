import { useMemo } from 'react';

import { useCaptainApiSession } from '../auth/captain-api-session';
import { CaptainPresenceScreen } from './captain-presence.screen';
import { HttpCaptainPresenceClient } from './captain-presence.client';
import { ExpoCaptainLocationProvider } from './expo-captain-location.provider';
import { ResilientCaptainPresencePort } from './resilient-captain-presence.port';

export function HardenedAuthenticatedCaptainPresenceScreen(): React.JSX.Element {
  const session = useCaptainApiSession();
  const client = useMemo(
    () =>
      new ResilientCaptainPresencePort(
        new HttpCaptainPresenceClient(session.apiBaseUrl, () => session.getAccessToken()),
        () => session.expireSession(),
      ),
    [session],
  );
  const locationProvider = useMemo(() => new ExpoCaptainLocationProvider(), []);

  return <CaptainPresenceScreen client={client} locationProvider={locationProvider} />;
}
