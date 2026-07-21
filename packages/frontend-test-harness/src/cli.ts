import { startFixtureServer } from './server';

const requestedPort = Number.parseInt(process.env['PORT'] ?? '4178', 10);
if (!Number.isSafeInteger(requestedPort) || requestedPort < 1 || requestedPort > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const server = await startFixtureServer({ port: requestedPort });
process.stdout.write(`Vastra frontend fixture server listening at ${server.origin}\n`);
