export interface MerchantOrderAlertAcknowledgement {
  readonly id: string;
  readonly orderId: string;
  readonly shopId: string;
  readonly status: 'ACKNOWLEDGED';
  readonly attemptCount: number;
  readonly firstSentAt: string | null;
  readonly lastSentAt: string | null;
  readonly acknowledgedAt: string;
  readonly acknowledgedBy: string;
  readonly expiresAt: string;
  readonly soundName: string;
  readonly failureReason: string | null;
  readonly reminderEligible: false;
  readonly soundShouldStop: true;
  readonly replayed: boolean;
}

export interface AcknowledgeMerchantOrderAlertResponse {
  readonly success: true;
  readonly data: {
    readonly alert: MerchantOrderAlertAcknowledgement;
  };
  readonly meta: {
    readonly requestId: null;
  };
}
