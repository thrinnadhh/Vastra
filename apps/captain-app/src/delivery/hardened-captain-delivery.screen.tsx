import { useMemo } from 'react';

import { useCaptainApiSession } from '../auth/captain-api-session';
import { HttpCaptainPresenceClient } from '../presence/captain-presence.client';
import { ExpoCaptainLocationProvider } from '../presence/expo-captain-location.provider';
import { HttpCaptainDeliveryClient } from './captain-delivery.client';
import { CaptainDeliveryScreen } from './captain-delivery.screen';
import { ResilientCaptainDeliveryPort } from './resilient-captain-delivery.port';

export function HardenedAuthenticatedCaptainDeliveryScreen(): React.JSX.Element {
  const session = useCaptainApiSession();
  const client = useMemo(
    () =>
      new ResilientCaptainDeliveryPort(
        new HttpCaptainDeliveryClient(session.apiBaseUrl, () => session.getAccessToken()),
        () => session.expireSession(),
      ),
    [session],
  );
  const presenceClient = useMemo(
    () => new HttpCaptainPresenceClient(session.apiBaseUrl, () => session.getAccessToken()),
    [session],
  );
  const locationProvider = useMemo(() => new ExpoCaptainLocationProvider(), []);

  return (
    <CaptainDeliveryScreen
      client={client}
      locationProvider={locationProvider}
      presenceClient={presenceClient}
    />
  );
}
