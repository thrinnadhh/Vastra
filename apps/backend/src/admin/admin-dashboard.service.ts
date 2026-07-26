import { Buffer } from 'node:buffer';

import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import type { AdminDashboardGateway, AdminOrderListInput } from './admin-dashboard.gateway';
import {
  ADMIN_ORDER_ISSUES,
  ADMIN_ORDER_STATUSES,
  type AdminDashboardSummary,
  type AdminOrderCursor,
  type AdminOrderIssue,
  type AdminOrderListResponse,
  type AdminOrderStatus,
  type AdminSearchResult,
} from './admin-dashboard.types';
import { ADMIN_DASHBOARD_GATEWAY } from './admin.tokens';

export class AdminSearchQueryInvalidError extends Error {}
export class AdminOrderListQueryInvalidError extends Error {}

function optionalMember<T extends string>(value: unknown, members: readonly T[]): T | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !members.some((member) => member === value)) {
    throw new AdminOrderListQueryInvalidError();
  }
  return value as T;
}

function parseOrderCursor(value: unknown): AdminOrderCursor | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AdminOrderListQueryInvalidError();
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
      throw new AdminOrderListQueryInvalidError();
    }
    const record = decoded as Record<string, unknown>;
    const createdAt = record['createdAt'];
    const id = record['id'];
    if (
      typeof createdAt !== 'string' ||
      Number.isNaN(Date.parse(createdAt)) ||
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)
    ) {
      throw new AdminOrderListQueryInvalidError();
    }
    return { createdAt, id };
  } catch (error: unknown) {
    if (error instanceof AdminOrderListQueryInvalidError) throw error;
    throw new AdminOrderListQueryInvalidError();
  }
}

function parseLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') return 20;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
    throw new AdminOrderListQueryInvalidError();
  }
  return Math.min(50, Math.max(1, Number(value)));
}

function encodeOrderCursor(cursor: AdminOrderCursor | null): string | null {
  if (cursor === null) return null;
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

@Injectable()
export class AdminDashboardService {
  public constructor(
    @Inject(ADMIN_DASHBOARD_GATEWAY)
    private readonly gateway: AdminDashboardGateway,
  ) {}

  public getSummary(context: AuthenticatedRequestContext): Promise<AdminDashboardSummary> {
    void context;
    return this.gateway.getSummary();
  }

  public search(
    context: AuthenticatedRequestContext,
    rawQuery: unknown,
    rawLimit: unknown,
  ): Promise<readonly AdminSearchResult[]> {
    void context;
    if (typeof rawQuery !== 'string') throw new AdminSearchQueryInvalidError();
    const query = rawQuery.trim();
    if (query.length < 2 || query.length > 120) throw new AdminSearchQueryInvalidError();
    const limit =
      typeof rawLimit === 'string' && /^\d+$/u.test(rawLimit)
        ? Math.min(50, Math.max(1, Number(rawLimit)))
        : 20;
    return this.gateway.search(query, limit);
  }

  public async listOrders(
    context: AuthenticatedRequestContext,
    rawStatus: unknown,
    rawIssue: unknown,
    rawCursor: unknown,
    rawLimit: unknown,
  ): Promise<AdminOrderListResponse> {
    void context;
    const cursor = parseOrderCursor(rawCursor);
    const input: AdminOrderListInput = {
      status: optionalMember<AdminOrderStatus>(rawStatus, ADMIN_ORDER_STATUSES),
      issue: optionalMember<AdminOrderIssue>(rawIssue, ADMIN_ORDER_ISSUES),
      cursorCreatedAt: cursor?.createdAt ?? null,
      cursorId: cursor?.id ?? null,
      limit: parseLimit(rawLimit),
    };
    const page = await this.gateway.listOrders(input);
    return {
      orders: page.orders,
      nextCursor: encodeOrderCursor(page.nextCursor),
    };
  }
}
