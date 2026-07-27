import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createApplication,
  disable,
  enableCors,
  enableShutdownHooks,
  listen,
  set,
  setGlobalPrefix,
  use,
  useBodyParser,
} = vi.hoisted(() => ({
  createApplication: vi.fn(),
  disable: vi.fn(),
  enableCors: vi.fn(),
  enableShutdownHooks: vi.fn(),
  listen: vi.fn(),
  set: vi.fn(),
  setGlobalPrefix: vi.fn(),
  use: vi.fn(),
  useBodyParser: vi.fn(),
}));

vi.mock('@nestjs/core', () => ({
  NestFactory: {
    create: createApplication,
  },
}));

vi.mock('./app.module', () => ({
  AppModule: Symbol('AppModule'),
}));

describe('backend bootstrap', () => {
  beforeEach(() => {
    createApplication.mockReset();
    listen.mockReset();
    disable.mockReset();
    enableCors.mockReset();
    enableShutdownHooks.mockReset();
    set.mockReset();
    setGlobalPrefix.mockReset();
    use.mockReset();
    useBodyParser.mockReset();
    listen.mockResolvedValue(undefined);
    createApplication.mockResolvedValue({
      enableCors,
      enableShutdownHooks,
      getHttpAdapter: () => ({ getInstance: () => ({ disable, set }) }),
      listen,
      setGlobalPrefix,
      use,
      useBodyParser,
    });
    delete process.env['PORT'];
    process.env['NODE_ENV'] = 'test';
  });

  afterEach(() => {
    delete process.env['PORT'];
    delete process.env['NODE_ENV'];
    vi.resetModules();
  });

  it('serves the mobile and OpenAPI contract under /v1', async () => {
    await import('./main.js');

    await vi.waitFor(() => {
      expect(listen).toHaveBeenCalledWith(8080);
    });

    expect(setGlobalPrefix).toHaveBeenCalledWith('v1');
    expect(setGlobalPrefix).toHaveBeenCalledTimes(1);
    expect(enableCors).toHaveBeenCalledTimes(1);
    expect(enableShutdownHooks).toHaveBeenCalledTimes(1);
    expect(disable).toHaveBeenCalledWith('x-powered-by');
    expect(useBodyParser).toHaveBeenCalledWith('json', { limit: '256kb' });
    expect(use).toHaveBeenCalled();
  });
});
