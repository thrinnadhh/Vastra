import { Inject, Injectable } from '@nestjs/common';

import type { OrderDispatchGateway } from './order-dispatch.gateway';
import { ORDER_DISPATCH_GATEWAY } from './order-dispatch.tokens';
import type { StartOrderDispatchResult } from './order-dispatch.types';
import { parseStartOrderDispatchInput } from './order-dispatch.validation';

@Injectable()
export class OrderDispatchService {
  public constructor(
    @Inject(ORDER_DISPATCH_GATEWAY)
    private readonly gateway: OrderDispatchGateway,
  ) {}

  public async start(value: unknown): Promise<StartOrderDispatchResult> {
    return this.gateway.start(parseStartOrderDispatchInput(value));
  }
}
