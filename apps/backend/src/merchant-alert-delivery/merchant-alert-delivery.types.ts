export const MERCHANT_ALERT_STOP_REASONS = [
  'ALERT_TERMINAL',
  'ORDER_NOT_WAITING',
  'EXPIRED',
  'NO_ELIGIBLE_DEVICE',
] as const;

export type MerchantAlertStopReason = (typeof MERCHANT_ALERT_STOP_REASONS)[number];

export interface MerchantAlertDeviceDestination {
  readonly deviceId: string;
  readonly pushToken: string;
}

export interface MerchantAlertDispatchClaim {
  readonly eventId: string;
  readonly alertId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly shopId: string;
  readonly shopName: string;
  readonly totalPaise: number;
  readonly expiresAt: string;
  readonly soundName: string;
  readonly eventAttemptNumber: number;
  readonly eventMaxAttempts: number;
  readonly deliverable: boolean;
  readonly stopReason: MerchantAlertStopReason | null;
  readonly devices: readonly MerchantAlertDeviceDestination[];
}

export type MerchantAlertDeviceOutcome = 'SENT' | 'FAILED' | 'SKIPPED';

export interface MerchantAlertDeviceResult {
  readonly deviceId: string;
  readonly outcome: MerchantAlertDeviceOutcome;
  readonly providerMessageId: string | null;
  readonly failureCode: string | null;
  readonly failureReason: string | null;
  readonly retryable: boolean;
}

export interface CompleteMerchantAlertDispatchCommand {
  readonly workerId: string;
  readonly eventId: string;
  readonly alertId: string;
  readonly stopReason: MerchantAlertStopReason | null;
  readonly results: readonly MerchantAlertDeviceResult[];
}

export interface CompleteMerchantAlertDispatchResult {
  readonly eventId: string;
  readonly alertId: string;
  readonly eventStatus: 'PUBLISHED' | 'FAILED' | 'DEAD_LETTER';
  readonly alertStatus: 'PENDING' | 'SENT' | 'DELIVERED' | 'ACKNOWLEDGED' | 'EXPIRED' | 'FAILED';
  readonly successfulDevices: number;
  readonly failedDevices: number;
  readonly retryAt: string | null;
  readonly stopped: boolean;
}

export interface MerchantAlertDeliveryGateway {
  claimDispatches(workerId: string, limit: number): Promise<readonly MerchantAlertDispatchClaim[]>;
  completeDispatch(
    command: CompleteMerchantAlertDispatchCommand,
  ): Promise<CompleteMerchantAlertDispatchResult>;
}

export interface MerchantAlertSender {
  send(
    claim: MerchantAlertDispatchClaim,
    destination: MerchantAlertDeviceDestination,
  ): Promise<MerchantAlertDeviceResult>;
}

export interface MerchantAlertDrainSummary {
  readonly claimed: number;
  readonly published: number;
  readonly retrying: number;
  readonly deadLettered: number;
  readonly stopped: number;
}
