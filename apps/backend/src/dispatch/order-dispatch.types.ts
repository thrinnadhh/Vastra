export interface StartOrderDispatchInput {
  readonly orderId: string;
  readonly idempotencyKey: string;
}

export interface StartOrderDispatchResult {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly deliveryTaskId: string;
  readonly orderStatus: 'CAPTAIN_SEARCHING';
  readonly deliveryTaskStatus: 'SEARCHING';
  readonly taskType: 'FORWARD_DELIVERY';
  readonly startedAt: string;
  readonly replayed: boolean;
}
