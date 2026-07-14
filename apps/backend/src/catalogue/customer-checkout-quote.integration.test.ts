import type { SupabaseClient } from '../auth/supabase-client.type';
import { Server } from 'node:http';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedHttpRequest, AuthenticatedRequestContext } from '../auth/auth.types';
import { CustomerCheckoutQuoteController } from './customer-checkout-quote.controller';
import type { CustomerCheckoutQuoteGateway } from './customer-checkout-quote.gateway';
import { CustomerCheckoutQuoteService } from './customer-checkout-quote.service';
import { CUSTOMER_CHECKOUT_QUOTE_GATEWAY } from './customer-checkout-quote.tokens';
import type {
  CreateCustomerCheckoutQuoteInput,
  CustomerCheckoutQuoteSnapshot,
} from './customer-checkout-quote.types';

const ACTOR_ID = '10000000-0000-4000-8000-000000000001';
const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';
const CART_ID = '30000000-0000-4000-8000-000000000001';
const QUOTE_ID = '40000000-0000-4000-8000-000000000001';
const emptyClient = Object.freeze({}) as unknown as SupabaseClient;

const context: AuthenticatedRequestContext = {
  actor: {
    id: ACTOR_ID,
    email: 'customer@example.test',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
  },
  accessToken: 'integration-token',
  supabase: emptyClient,
};

class IntegrationGateway implements CustomerCheckoutQuoteGateway {
  public actorId: string | null = null;
  public input: CreateCustomerCheckoutQuoteInput | null = null;

  public createQuote(
    actorId: string,
    input: CreateCustomerCheckoutQuoteInput,
  ): Promise<CustomerCheckoutQuoteSnapshot> {
    this.actorId = actorId;
    this.input = input;

    return Promise.resolve({
      id: QUOTE_ID,
      cartId: CART_ID,
      address: {
        id: input.addressId,
        label: 'Home',
        recipientName: 'Customer',
        phoneNumber: '9000000001',
        line1: 'Quote Street',
        line2: null,
        landmark: null,
        area: 'Tirupati',
        city: 'Tirupati',
        state: 'Andhra Pradesh',
        postalCode: '517501',
        countryCode: 'IN',
        latitude: 13.6288,
        longitude: 79.4192,
      },
      shop: {
        id: '50000000-0000-4000-8000-000000000001',
        name: 'Quote Shop',
        slug: 'quote-shop',
        minimumOrderPaise: 0,
        averagePreparationMinutes: 20,
        distanceMeters: 500,
        serviceRadiusMeters: 5000,
      },
      items: [
        {
          cartItemId: '60000000-0000-4000-8000-000000000001',
          variantId: '70000000-0000-4000-8000-000000000001',
          productId: '80000000-0000-4000-8000-000000000001',
          productName: 'Quote Kurta',
          sku: 'QUOTE-KURTA-M',
          colourName: 'Blue',
          sizeLabel: 'M',
          quantity: 1,
          previousUnitPricePaise: 50000,
          unitPricePaise: 50000,
          priceChanged: false,
          availableQuantity: 3,
          inventoryVersion: 1,
          lineTotalPaise: 50000,
        },
      ],
      totals: {
        subtotalPaise: 50000,
        productDiscountPaise: 0,
        couponDiscountPaise: 0,
        deliveryFeePaise: 0,
        platformFeePaise: 0,
        taxPaise: 0,
        totalPaise: 50000,
      },
      estimatedPreparationMinutes: 20,
      estimatedTravelMinutes: 15,
      estimatedDeliveryAt: '2026-07-15T21:35:00.000Z',
      expiresAt: '2026-07-15T21:05:00.000Z',
      createdAt: '2026-07-15T21:00:00.000Z',
    });
  }
}

function isHttpServer(value: unknown): value is Server {
  return value instanceof Server;
}

function requireHttpServer(application: INestApplication): Server {
  const server: unknown = application.getHttpServer();
  if (!isHttpServer(server)) {
    throw new TypeError('Expected Nest to provide a Node HTTP server');
  }

  return server;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${label} object`);
  }

  return value as Record<string, unknown>;
}

function readData(body: unknown): Record<string, unknown> {
  return requireRecord(requireRecord(body, 'response')['data'], 'response data');
}

function readErrorCode(body: unknown): string {
  const error = requireRecord(requireRecord(body, 'response')['error'], 'response error');
  const code = error['code'];
  if (typeof code !== 'string') {
    throw new TypeError('Expected error code');
  }

  return code;
}

describe('customer checkout quote integration', () => {
  let app: INestApplication | undefined;
  let httpServer: Server;
  let gateway: IntegrationGateway;

  beforeAll(async () => {
    gateway = new IntegrationGateway();

    const testingModule = await Test.createTestingModule({
      controllers: [CustomerCheckoutQuoteController],
      providers: [
        CustomerCheckoutQuoteService,
        {
          provide: CUSTOMER_CHECKOUT_QUOTE_GATEWAY,
          useValue: gateway,
        },
      ],
    }).compile();

    const application = testingModule.createNestApplication();
    application.use(
      (incomingRequest: AuthenticatedHttpRequest, response: unknown, next: () => void): void => {
        void response;
        incomingRequest.authContext = context;
        next();
      },
    );
    app = application;
    await application.init();
    httpServer = requireHttpServer(application);
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('creates a quote through POST /checkout/quote', async () => {
    const response = await request(httpServer)
      .post('/checkout/quote')
      .send({ addressId: ADDRESS_ID });

    expect(response.status).toBe(200);
    const quote = requireRecord(readData(response.body)['quote'], 'quote');
    expect(quote['id']).toBe(QUOTE_ID);
    expect(gateway.actorId).toBe(ACTOR_ID);
    expect(gateway.input).toStrictEqual({ addressId: ADDRESS_ID });
  });

  it('rejects an invalid address identifier', async () => {
    const response = await request(httpServer)
      .post('/checkout/quote')
      .send({ addressId: 'invalid' });

    expect(response.status).toBe(400);
    expect(readErrorCode(response.body)).toBe('VALIDATION_ERROR');
  });
});
