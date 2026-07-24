import { createServer, type Server } from 'node:http';

import {
  CUSTOMER_ACCESS_NAVIGATION_SCENARIO_ROUTE,
  renderCustomerAccessNavigationScenario,
} from './customer-access-navigation-scenario';
import {
  CUSTOMER_COD_CHECKOUT_SCENARIO_ROUTE,
  renderCustomerCodCheckoutScenario,
} from './customer-cod-checkout-document';
import { FRONTEND_FIXTURES, getFrontendFixture } from './fixtures';
import { renderFixtureIndex, renderFixturePage } from './html';

export interface FixtureServerOptions {
  readonly host?: string;
  readonly port?: number;
}

export interface RunningFixtureServer {
  readonly origin: string;
  close(): Promise<void>;
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
}

export async function startFixtureServer(
  options: FixtureServerOptions = {},
): Promise<RunningFixtureServer> {
  const host = options.host ?? '127.0.0.1';
  const requestedPort = options.port ?? 4178;
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${host}`);
    if (requestUrl.pathname === '/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ status: 'ok', fixtureCount: FRONTEND_FIXTURES.length }));
      return;
    }
    if (requestUrl.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(renderFixtureIndex(FRONTEND_FIXTURES));
      return;
    }
    if (requestUrl.pathname === CUSTOMER_ACCESS_NAVIGATION_SCENARIO_ROUTE) {
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
      });
      response.end(renderCustomerAccessNavigationScenario());
      return;
    }
    if (requestUrl.pathname === CUSTOMER_COD_CHECKOUT_SCENARIO_ROUTE) {
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
      });
      response.end(renderCustomerCodCheckoutScenario());
      return;
    }
    const match = /^\/fixtures\/([a-z0-9-]+)$/.exec(requestUrl.pathname);
    const fixture = match?.[1] === undefined ? null : getFrontendFixture(match[1]);
    if (fixture === null) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Fixture not found');
      return;
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    });
    response.end(renderFixturePage(fixture));
  });

  await listen(server, requestedPort, host);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    await close(server);
    throw new Error('Fixture server did not expose a TCP address');
  }

  return {
    origin: `http://${host}:${String(address.port)}`,
    close: () => close(server),
  };
}
