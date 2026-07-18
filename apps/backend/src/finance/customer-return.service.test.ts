import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { CustomerReturnGateway } from './customer-return.gateway';
import { CustomerReturnService } from './customer-return.service';
import type {
  CreateCustomerReturnInput,
  CustomerReturnDetail,
  CustomerReturnEligibility,
} from './customer-return.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const RETURN_ID = '30000000-0000-4000-8000-000000000001';
const KEY = '40000000-0000-4000-8000-000000000001';
const CONTEXT = { actor: { id: ACTOR_ID } } as AuthenticatedRequestContext;

class GatewayStub implements CustomerReturnGateway {
  public input: CreateCustomerReturnInput | null = null;
  public getEligibility(actorId: string, orderId: string) {
    void actorId;
    void orderId;
    return Promise.resolve({ eligible: true } as CustomerReturnEligibility);
  }
  public create(actorId: string, orderId: string, input: CreateCustomerReturnInput) {
    void actorId;
    void orderId;
    this.input = input;
    return Promise.resolve({ returnId: RETURN_ID } as CustomerReturnDetail);
  }
  public get(actorId: string, returnId: string) {
    void actorId;
    void returnId;
    return Promise.resolve({ returnId: RETURN_ID } as CustomerReturnDetail);
  }
}

describe('CustomerReturnService', () => {
  it('parses unique item quantities and creates the return', async () => {
    const gateway = new GatewayStub();
    const service = new CustomerReturnService(gateway);
    const result = await service.create(CONTEXT, ORDER_ID, KEY, {
      items: [{ orderItemId: RETURN_ID, quantity: 1, reasonCode: 'WRONG_SIZE' }],
      customerNote: 'Size did not fit',
    });
    expect(result.data).toEqual({ returnId: RETURN_ID });
    expect(gateway.input).toEqual({
      items: [{ orderItemId: RETURN_ID, quantity: 1, reasonCode: 'WRONG_SIZE' }],
      customerNote: 'Size did not fit',
      idempotencyKey: KEY,
    });
  });

  it('rejects duplicate order-item lines before the gateway call', async () => {
    const service = new CustomerReturnService(new GatewayStub());
    await expect(
      service.create(CONTEXT, ORDER_ID, KEY, {
        items: [
          { orderItemId: RETURN_ID, quantity: 1, reasonCode: 'WRONG_SIZE' },
          { orderItemId: RETURN_ID, quantity: 1, reasonCode: 'QUALITY' },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
