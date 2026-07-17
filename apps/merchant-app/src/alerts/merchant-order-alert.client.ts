import type { MerchantApiSession } from '../auth/merchant-api-session';

export class MerchantOrderAlertAcknowledgementError extends Error {
  public constructor() {
    super('Merchant order alert acknowledgement failed');
    this.name = 'MerchantOrderAlertAcknowledgementError';
  }
}

export interface MerchantOrderAlertClient {
  acknowledge(alertId: string): Promise<void>;
}

export class HttpMerchantOrderAlertClient implements MerchantOrderAlertClient {
  public constructor(private readonly session: MerchantApiSession) {}

  public async acknowledge(alertId: string): Promise<void> {
    const accessToken = await this.session.getAccessToken();
    if (accessToken === null) throw new MerchantOrderAlertAcknowledgementError();

    try {
      const response = await fetch(
        `${this.session.apiBaseUrl}/merchant/order-alerts/${encodeURIComponent(alertId)}/acknowledge`,
        {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        },
      );
      if (!response.ok) throw new MerchantOrderAlertAcknowledgementError();
    } catch (error: unknown) {
      if (error instanceof MerchantOrderAlertAcknowledgementError) throw error;
      throw new MerchantOrderAlertAcknowledgementError();
    }
  }
}
