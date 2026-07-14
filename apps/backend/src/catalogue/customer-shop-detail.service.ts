import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedRequestContext } from '../auth/auth.types';
import {
  createCatalogueProviderUnavailableException,
  createCatalogueStateInvalidException,
  createCustomerCatalogueShopNotFoundException,
  createInvalidCustomerCatalogueReadException,
} from './catalogue-http-error';
import {
  type CustomerShopDetailGateway,
  CustomerShopDetailDataInvalidError,
  CustomerShopDetailGatewayUnavailableError,
} from './customer-shop-detail.gateway';
import { CUSTOMER_SHOP_DETAIL_GATEWAY } from './customer-shop-detail.tokens';
import type {
  CustomerShopDetailCore,
  CustomerShopDetailSnapshot,
  CustomerShopHourRecord,
  CustomerShopOrderingStatus,
  CustomerShopTodayHoursSnapshot,
  CustomerShopWeeklyHoursSnapshot,
  GetCustomerShopDetailResponse,
} from './customer-shop-detail.types';
import {
  CustomerShopDetailValidationError,
  parseCustomerShopDetailQuery,
} from './customer-shop-detail.validation';

const SHOP_TIME_ZONE = 'Asia/Kolkata' as const;
const WEEKDAY_TO_NUMBER: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface LocalDateTime {
  readonly date: string;
  readonly dayOfWeek: number;
  readonly time: string;
}

interface EffectiveHours {
  readonly source: 'WEEKLY' | 'SPECIAL_DATE' | 'NONE';
  readonly isClosed: boolean;
  readonly opensAt: string | null;
  readonly closesAt: string | null;
}

function requirePart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const value = parts.find((part) => part.type === type)?.value;

  if (value === undefined) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return value;
}

function toLocalDateTime(value: Date): LocalDateTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const weekday = requirePart(parts, 'weekday');
  const dayOfWeek = WEEKDAY_TO_NUMBER[weekday];

  if (dayOfWeek === undefined) {
    throw new CustomerShopDetailDataInvalidError();
  }

  return {
    date: [requirePart(parts, 'year'), requirePart(parts, 'month'), requirePart(parts, 'day')].join(
      '-',
    ),
    dayOfWeek,
    time: [
      requirePart(parts, 'hour'),
      requirePart(parts, 'minute'),
      requirePart(parts, 'second'),
    ].join(':'),
  };
}

function previousLocalDate(local: LocalDateTime): LocalDateTime {
  const midnight = new Date(`${local.date}T00:00:00.000Z`);

  if (Number.isNaN(midnight.valueOf())) {
    throw new CustomerShopDetailDataInvalidError();
  }

  midnight.setUTCDate(midnight.getUTCDate() - 1);

  return {
    date: midnight.toISOString().slice(0, 10),
    dayOfWeek: midnight.getUTCDay(),
    time: local.time,
  };
}

function selectEffectiveHours(
  records: readonly CustomerShopHourRecord[],
  local: LocalDateTime,
): EffectiveHours {
  const special = records.find(
    (record) => record.scheduleType === 'SPECIAL_DATE' && record.specialDate === local.date,
  );

  if (special !== undefined) {
    return {
      source: 'SPECIAL_DATE',
      isClosed: special.isClosed,
      opensAt: special.opensAt,
      closesAt: special.closesAt,
    };
  }

  const weekly = records.find(
    (record) => record.scheduleType === 'WEEKLY' && record.dayOfWeek === local.dayOfWeek,
  );

  if (weekly !== undefined) {
    return {
      source: 'WEEKLY',
      isClosed: weekly.isClosed,
      opensAt: weekly.opensAt,
      closesAt: weekly.closesAt,
    };
  }

  return {
    source: 'NONE',
    isClosed: true,
    opensAt: null,
    closesAt: null,
  };
}

function isWithinSchedule(schedule: EffectiveHours, currentTime: string): boolean {
  if (schedule.isClosed || schedule.opensAt === null || schedule.closesAt === null) {
    return false;
  }

  if (schedule.opensAt < schedule.closesAt) {
    return currentTime >= schedule.opensAt && currentTime < schedule.closesAt;
  }

  return currentTime >= schedule.opensAt;
}

function isWithinPreviousOvernightSchedule(schedule: EffectiveHours, currentTime: string): boolean {
  return (
    !schedule.isClosed &&
    schedule.opensAt !== null &&
    schedule.closesAt !== null &&
    schedule.opensAt > schedule.closesAt &&
    currentTime < schedule.closesAt
  );
}

function buildWeeklyHours(
  records: readonly CustomerShopHourRecord[],
): readonly CustomerShopWeeklyHoursSnapshot[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const record = records.find(
      (candidate) => candidate.scheduleType === 'WEEKLY' && candidate.dayOfWeek === dayOfWeek,
    );

    return {
      dayOfWeek,
      isClosed: record?.isClosed ?? true,
      opensAt: record?.opensAt ?? null,
      closesAt: record?.closesAt ?? null,
    };
  });
}

function buildTodayHours(
  records: readonly CustomerShopHourRecord[],
  now: Date,
): CustomerShopTodayHoursSnapshot {
  const local = toLocalDateTime(now);
  const today = selectEffectiveHours(records, local);
  const previous = selectEffectiveHours(records, previousLocalDate(local));
  const isOpenNow =
    isWithinSchedule(today, local.time) || isWithinPreviousOvernightSchedule(previous, local.time);

  return {
    date: local.date,
    dayOfWeek: local.dayOfWeek,
    timeZone: SHOP_TIME_ZONE,
    source: today.source,
    isClosed: today.isClosed,
    opensAt: today.opensAt,
    closesAt: today.closesAt,
    isOpenNow,
  };
}

function deriveOrderingStatus(
  core: CustomerShopDetailCore,
  isOpenNow: boolean,
): CustomerShopOrderingStatus {
  if (!core.isServiceable) {
    return 'OUTSIDE_SERVICE_AREA';
  }

  if (!core.acceptsOnlineOrders) {
    return 'ONLINE_ORDERS_DISABLED';
  }

  if (!isOpenNow || (core.operationalStatus !== 'OPEN' && core.operationalStatus !== 'BUSY')) {
    return 'CLOSED';
  }

  return core.operationalStatus === 'BUSY' ? 'BUSY' : 'ACCEPTING_ORDERS';
}

function buildShopDetail(
  core: CustomerShopDetailCore,
  hours: readonly CustomerShopHourRecord[],
  queryLatitude: number,
  queryLongitude: number,
  now: Date,
): CustomerShopDetailSnapshot {
  const todayHours = buildTodayHours(hours, now);
  const orderingStatus = deriveOrderingStatus(core, todayHours.isOpenNow);

  return {
    id: core.id,
    name: core.name,
    slug: core.slug,
    description: core.description,
    phoneNumber: core.phoneNumber,
    email: core.email,
    location: {
      latitude: core.latitude,
      longitude: core.longitude,
    },
    operationalStatus: core.operationalStatus,
    acceptsOnlineOrders: core.acceptsOnlineOrders,
    orderingStatus,
    canPlaceOrder: orderingStatus === 'ACCEPTING_ORDERS' || orderingStatus === 'BUSY',
    serviceability: {
      customerLatitude: queryLatitude,
      customerLongitude: queryLongitude,
      distanceMeters: core.distanceMeters,
      serviceRadiusMeters: core.serviceRadiusMeters,
      isServiceable: core.isServiceable,
    },
    todayHours,
    weeklyHours: buildWeeklyHours(hours),
    minimumOrderPaise: core.minimumOrderPaise,
    averagePreparationMinutes: core.averagePreparationMinutes,
    ratingAverage: core.ratingAverage,
    ratingCount: core.ratingCount,
    followerCount: core.followerCount,
  };
}

@Injectable()
export class CustomerShopDetailService {
  public constructor(
    @Inject(CUSTOMER_SHOP_DETAIL_GATEWAY)
    private readonly gateway: CustomerShopDetailGateway,
  ) {}

  public async getShopDetail(
    context: AuthenticatedRequestContext,
    shopIdValue: unknown,
    latitudeValue: unknown,
    longitudeValue: unknown,
  ): Promise<GetCustomerShopDetailResponse> {
    try {
      const query = parseCustomerShopDetailQuery(shopIdValue, latitudeValue, longitudeValue);
      const core = await this.gateway.findPublicShopDetail(context.supabase, query);

      if (core === null) {
        throw createCustomerCatalogueShopNotFoundException();
      }

      const hours = await this.gateway.listPublicShopHours(context.supabase, query.shopId);
      const shop = buildShopDetail(core, hours, query.latitude, query.longitude, new Date());

      return {
        success: true,
        data: {
          shop,
        },
        meta: {
          requestId: null,
        },
      };
    } catch (error: unknown) {
      return this.rethrowMappedError(error);
    }
  }

  private rethrowMappedError(error: unknown): never {
    if (error instanceof CustomerShopDetailValidationError) {
      throw createInvalidCustomerCatalogueReadException();
    }

    if (error instanceof CustomerShopDetailGatewayUnavailableError) {
      throw createCatalogueProviderUnavailableException();
    }

    if (error instanceof CustomerShopDetailDataInvalidError) {
      throw createCatalogueStateInvalidException();
    }

    throw error;
  }
}
