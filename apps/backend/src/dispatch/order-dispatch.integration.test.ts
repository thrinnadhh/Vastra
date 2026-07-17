import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SupabaseClient } from '../auth/supabase-client.type';
import { CAPTAIN_PRESENCE_GATEWAY } from './captain-presence.tokens';
import { DispatchModule } from './dispatch.module';
import {
  type OrderDispatchGateway,
  OrderDispatchDataInvalidError,
  OrderDispatchNotFoundError,
  SupabaseOrderDispatchGateway,
} from './order-dispatch.gateway';
import { OrderDispatchService } from './order-dispatch.service';
import { ORDER_DISPATCH_GATEWAY } from './order-dispatch.tokens';
import type { StartOrderDispatchInput, StartOrderDispatchResult } from './order-dispatch.types';

const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const KEY = '30000000-0000-4000-8000-000000000001';
const RESULT: StartOrderDispatchResult = {
  orderId: ORDER_ID,
  orderNumber: 'VAS-DISPATCH-1',
  deliveryTaskId: '40000000-0000-4000-8000-000000000001',
  orderStatus: 'CAPTAIN_SEARCHING',
  deliveryTaskStatus: 'SEARCHING',
  taskType: 'FORWARD_DELIVERY',
  startedAt: '2026-07-16T05:30:00.000Z',
  replayed: false,
};

class IntegrationGateway implements OrderDispatchGateway {
  public static call: StartOrderDispatchInput | null = null;
  public start(input: StartOrderDispatchInput): Promise<StartOrderDispatchResult> {
    IntegrationGateway.call = input;
    return Promise.resolve(RESULT);
  }
}

describe('dispatch module and gateway integration', () => {
  let app: INestApplication | undefined;
  let server: Server;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [DispatchModule] })
      .overrideProvider(CAPTAIN_PRESENCE_GATEWAY)
      .useValue(Object.freeze({}))
      .overrideProvider(ORDER_DISPATCH_GATEWAY)
      .useClass(IntegrationGateway)
      .compile();
    app = module.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('resolves the exported internal service and registered gateway', async () => {
    const service = app?.get(OrderDispatchService);
    await expect(service?.start({ orderId: ORDER_ID, idempotencyKey: KEY })).resolves.toStrictEqual(
      RESULT,
    );
    expect(IntegrationGateway.call).toStrictEqual({ orderId: ORDER_ID, idempotencyKey: KEY });
  });

  it('does not expose a dispatch-start HTTP route', async () => {
    const response = await request(server)
      .post(`/dispatch/orders/${ORDER_ID}/start`)
      .send({ idempotencyKey: KEY });
    expect(response.status).toBe(404);
  });

  it('maps a valid RPC response and exact arguments', async () => {
    const calls: unknown[] = [];
    const client = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push([name, args]);
        return Promise.resolve({ data: RESULT, error: null });
      },
    } as unknown as SupabaseClient;
    await expect(
      new SupabaseOrderDispatchGateway(client).start({ orderId: ORDER_ID, idempotencyKey: KEY }),
    ).resolves.toStrictEqual(RESULT);
    expect(calls).toStrictEqual([
      ['start_order_dispatch', { p_order_id: ORDER_ID, p_idempotency_key: KEY }],
    ]);
  });

  it('rejects an invalid RPC payload', async () => {
    const client = {
      rpc() {
        return Promise.resolve({
          data: { ...RESULT, deliveryTaskId: 'invalid' },
          error: null,
        });
      },
    } as unknown as SupabaseClient;
    await expect(
      new SupabaseOrderDispatchGateway(client).start({ orderId: ORDER_ID, idempotencyKey: KEY }),
    ).rejects.toBeInstanceOf(OrderDispatchDataInvalidError);
  });

  it('normalizes a known database error', async () => {
    const client = {
      rpc() {
        return Promise.resolve({ data: null, error: { code: 'P0029' } });
      },
    } as unknown as SupabaseClient;
    await expect(
      new SupabaseOrderDispatchGateway(client).start({ orderId: ORDER_ID, idempotencyKey: KEY }),
    ).rejects.toBeInstanceOf(OrderDispatchNotFoundError);
  });
});
