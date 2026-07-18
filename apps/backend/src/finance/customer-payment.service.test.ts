import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { CustomerPaymentGateway } from './customer-payment.gateway';
import { CustomerPaymentService } from './customer-payment.service';
import type {
  CustomerPaymentCheckout,
  PlaceCustomerOnlineOrderInput,
  PreparedCustomerPayment,
} from './customer-payment.types';
import type {
  CreateProviderOrderInput,
  CreateProviderRefundInput,
  PaymentProviderGateway,
  ProviderCheckoutSession,
  ProviderOrderSnapshot,
  ProviderRefundSnapshot,
  VerifiedProviderPaymentEvent,
  VerifyProviderWebhookInput,
} from './payment-provider.contract';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ORDER_ID = '20000000-0000-4000-8000-000000000001';
const PAYMENT_ID = '30000000-0000-4000-8000-000000000001';
const KEY = '40000000-0000-4000-8000-000000000001';
const CONTEXT = { actor: { id: ACTOR_ID } } as AuthenticatedRequestContext;

const checkout: CustomerPaymentCheckout = {
  orderId: ORDER_ID,
  orderNumber: 'VAS-ORDER',
  paymentId: PAYMENT_ID,
  provider: 'cashfree',
  providerOrderId: 'VASPAY30000000000040008000000000000001',
  providerReferenceId: '123456',
  paymentSessionId: 'session-1',
  amountPaise: 12500,
  currency: 'INR',
  paymentStatus: 'PENDING',
  expiresAt: null,
  replayed: false,
};

class CustomerGatewayStub implements CustomerPaymentGateway {
  public attachCalls = 0;
  public prepared: PreparedCustomerPayment = {
    orderId: ORDER_ID,
    orderNumber: 'VAS-ORDER',
    paymentId: PAYMENT_ID,
    providerOrderId: checkout.providerOrderId,
    amountPaise: checkout.amountPaise,
    currency: 'INR',
    customerPhone: '+919999999999',
    paymentStatus: 'CREATED',
    providerReferenceId: null,
    paymentSessionId: null,
    paymentSessionExpiresAt: null,
    replayed: false,
  };
  public prepare(actorId: string, input: PlaceCustomerOnlineOrderInput) {
    void actorId;
    void input;
    return Promise.resolve(this.prepared);
  }
  public attachSession(actorId: string, paymentId: string, session: ProviderCheckoutSession) {
    void actorId;
    void paymentId;
    void session;
    this.attachCalls += 1;
    return Promise.resolve(checkout);
  }
  public getLatest(actorId: string, orderId: string) {
    void actorId;
    void orderId;
    return Promise.resolve(checkout);
  }
}

class ProviderStub implements PaymentProviderGateway {
  public createCalls = 0;
  public createOrder(input: CreateProviderOrderInput) {
    void input;
    this.createCalls += 1;
    return Promise.resolve({
      provider: 'cashfree' as const,
      providerOrderId: checkout.providerOrderId,
      providerReferenceId: checkout.providerReferenceId,
      paymentSessionId: checkout.paymentSessionId,
      amountPaise: checkout.amountPaise,
      currency: 'INR' as const,
      expiresAt: null,
    });
  }
  public fetchOrder(providerOrderId: string): Promise<ProviderOrderSnapshot> {
    void providerOrderId;
    throw new Error('not used');
  }
  public verifyWebhook(input: VerifyProviderWebhookInput): VerifiedProviderPaymentEvent {
    void input;
    throw new Error('not used');
  }
  public createRefund(input: CreateProviderRefundInput): Promise<ProviderRefundSnapshot> {
    void input;
    throw new Error('not used');
  }
  public fetchRefund(
    providerOrderId: string,
    providerRefundId: string,
  ): Promise<ProviderRefundSnapshot> {
    void providerOrderId;
    void providerRefundId;
    throw new Error('not used');
  }
}

describe('CustomerPaymentService', () => {
  it('creates one provider session and attaches it to the prepared payment', async () => {
    const gateway = new CustomerGatewayStub();
    const provider = new ProviderStub();
    const service = new CustomerPaymentService(gateway, provider);
    const result = await service.createCheckout(CONTEXT, KEY, {
      cartId: ORDER_ID,
      quoteId: PAYMENT_ID,
      addressId: ACTOR_ID,
    });
    expect(result.data).toEqual(checkout);
    expect(provider.createCalls).toBe(1);
    expect(gateway.attachCalls).toBe(1);
  });

  it('returns an existing session without creating another provider order', async () => {
    const gateway = new CustomerGatewayStub();
    gateway.prepared = {
      ...gateway.prepared,
      paymentStatus: 'PENDING',
      providerReferenceId: checkout.providerReferenceId,
      paymentSessionId: checkout.paymentSessionId,
    };
    const provider = new ProviderStub();
    const service = new CustomerPaymentService(gateway, provider);
    const result = await service.createCheckout(CONTEXT, KEY, {
      cartId: ORDER_ID,
      quoteId: PAYMENT_ID,
      addressId: ACTOR_ID,
    });
    expect(result.data).toEqual(checkout);
    expect(provider.createCalls).toBe(0);
    expect(gateway.attachCalls).toBe(0);
  });
});
