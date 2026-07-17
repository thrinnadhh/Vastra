export interface MerchantAlertDeliveryMetrics {
  readonly windowMinutes: number;
  readonly generatedAt: string;
  readonly alertsCreated: number;
  readonly alertsSent: number;
  readonly alertsAcknowledged: number;
  readonly alertsExpired: number;
  readonly alertsFailed: number;
  readonly averageAcknowledgementSeconds: number;
  readonly activeAlerts: number;
  readonly remindersQueued: number;
  readonly deliveryAttempts: number;
  readonly successfulAttempts: number;
  readonly failedAttempts: number;
  readonly retryableFailures: number;
  readonly unregisteredTokens: number;
  readonly outboxBacklog: number;
}

export interface MerchantAlertDeliveryActivity {
  readonly alertId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly shopId: string;
  readonly shopName: string;
  readonly alertStatus: string;
  readonly attemptCount: number;
  readonly reminderCount: number;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly acknowledgedAt: string | null;
  readonly expiredAt: string | null;
  readonly failureReason: string | null;
  readonly successfulDeviceAttempts: number;
  readonly failedDeviceAttempts: number;
  readonly retryableDeviceFailures: number;
  readonly lastAttemptAt: string | null;
  readonly lastFailureCode: string | null;
}

export interface MerchantAlertObservabilityGateway {
  getMetrics(windowMinutes: number): Promise<MerchantAlertDeliveryMetrics>;
  listActivity(limit: number, before: string | null): Promise<readonly MerchantAlertDeliveryActivity[]>;
}

export interface MerchantAlertMetricsResponse {
  readonly success: true;
  readonly data: { readonly metrics: MerchantAlertDeliveryMetrics };
  readonly meta: { readonly requestId: null };
}

export interface MerchantAlertActivityResponse {
  readonly success: true;
  readonly data: {
    readonly activity: readonly MerchantAlertDeliveryActivity[];
    readonly nextCursor: string | null;
  };
  readonly meta: { readonly requestId: null };
}
