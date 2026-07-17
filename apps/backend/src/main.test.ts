import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createApplication, listen, setGlobalPrefix } = vi.hoisted(() => ({
  createApplication: vi.fn(),
  listen: vi.fn(),
  setGlobalPrefix: vi.fn(),
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
    setGlobalPrefix.mockReset();
    listen.mockResolvedValue(undefined);
    createApplication.mockResolvedValue({ listen, setGlobalPrefix });
    delete process.env['PORT'];
  });

  afterEach(() => {
    delete process.env['PORT'];
    vi.resetModules();
  });

  it('serves the mobile and OpenAPI contract under /v1', async () => {
    await import('./main.js');

    await vi.waitFor(() => {
      expect(listen).toHaveBeenCalledWith(8080);
    });

    expect(setGlobalPrefix).toHaveBeenCalledWith('v1');
    expect(setGlobalPrefix).toHaveBeenCalledTimes(1);
  });
});
