import type {
  MerchantOrderDetail,
  MerchantOrderPage,
  MerchantOrderReadPort,
  MerchantOrderSummary,
} from './merchant-order.types';

function uniqueOrders(
  orders: readonly MerchantOrderSummary[],
  seen: Set<string>,
): readonly MerchantOrderSummary[] {
  const unique: MerchantOrderSummary[] = [];
  for (const order of orders) {
    if (seen.has(order.id)) continue;
    seen.add(order.id);
    unique.push(order);
  }
  return unique;
}

export class DeduplicatingMerchantOrderReadPort implements MerchantOrderReadPort {
  private readonly seenOrderIds = new Set<string>();

  public constructor(private readonly delegate: MerchantOrderReadPort) {}

  public async listOrders(input: {
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<MerchantOrderPage> {
    if (input.cursor === undefined) this.seenOrderIds.clear();
    const page = await this.delegate.listOrders(input);
    return {
      orders: uniqueOrders(page.orders, this.seenOrderIds),
      nextCursor: page.nextCursor,
    };
  }

  public getOrder(orderId: string): Promise<MerchantOrderDetail> {
    return this.delegate.getOrder(orderId);
  }
}
