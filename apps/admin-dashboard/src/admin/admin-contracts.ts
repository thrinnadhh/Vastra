import { ADMIN_PERMISSIONS, type AdminPermission } from './admin-types';
import type {
  AdminAuditEntry,
  AdminCapabilities,
  AdminCityControlPlane,
  AdminCityMutationResult,
  AdminCityPreflightReport,
  AdminMarketLifecycleStatus,
  AdminCaptainListItem,
  AdminCaptainPage,
  AdminCaptainSnapshot,
  AdminDashboardSummary,
  AdminMerchantListItem,
  AdminMerchantPage,
  AdminMerchantSnapshot,
  AdminOperationalOrder,
  AdminOperationOutcome,
  AdminOrderInvestigation,
  AdminOrderPage,
  AdminSearchResult,
  AdminStatusHistoryEntry,
} from './admin-types';

export class AdminContractError extends Error {}

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function record(value: unknown, label = 'record'): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) throw new AdminContractError(`Expected ${label}`);
  return value;
}

export function array(value: unknown, label = 'array'): readonly unknown[] {
  if (!Array.isArray(value)) throw new AdminContractError(`Expected ${label}`);
  return value;
}

export function string(value: unknown, label = 'string'): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AdminContractError(`Expected ${label}`);
  }
  return value;
}

export function nullableString(value: unknown, label = 'nullable string'): string | null {
  if (value === null || value === undefined) return null;
  return string(value, label);
}

export function number(value: unknown, label = 'number'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AdminContractError(`Expected ${label}`);
  }
  return value;
}

export function integer(value: unknown, label = 'integer'): number {
  const parsed = number(value, label);
  if (!Number.isInteger(parsed)) throw new AdminContractError(`Expected ${label}`);
  return parsed;
}

export function boolean(value: unknown, label = 'boolean'): boolean {
  if (typeof value !== 'boolean') throw new AdminContractError(`Expected ${label}`);
  return value;
}

export function nullableRecord(
  value: unknown,
  label = 'nullable record',
): Readonly<Record<string, unknown>> | null {
  if (value === null || value === undefined) return null;
  return record(value, label);
}

function envelopeData(value: unknown): Readonly<Record<string, unknown>> {
  const outer = record(value, 'API response');
  if (outer['success'] !== true) throw new AdminContractError('Expected successful API response');
  return record(outer['data'], 'API data');
}

function directOrEnvelope(value: unknown): Readonly<Record<string, unknown>> {
  const outer = record(value);
  if (outer['success'] === true && isRecord(outer['data'])) return outer['data'];
  return outer;
}

function permission(value: unknown): AdminPermission {
  const parsed = string(value, 'admin permission');
  if (!ADMIN_PERMISSIONS.includes(parsed as AdminPermission)) {
    throw new AdminContractError('Unknown admin permission');
  }
  return parsed as AdminPermission;
}

export function parseCapabilities(value: unknown): AdminCapabilities {
  const data = envelopeData(value);
  const assuranceLevel = string(data['assuranceLevel'], 'assurance level');
  if (assuranceLevel !== 'aal1' && assuranceLevel !== 'aal2') {
    throw new AdminContractError('Unknown assurance level');
  }
  if (data['mfaRequiredForSensitiveOperations'] !== true) {
    throw new AdminContractError('Missing MFA policy');
  }
  return {
    assuranceLevel,
    permissions: array(data['permissions'], 'permissions').map(permission),
    mfaRequiredForSensitiveOperations: true,
  };
}

export function parseDashboard(value: unknown): AdminDashboardSummary {
  const data = directOrEnvelope(value);
  return {
    openOrders: integer(data['openOrders']),
    interventionOrders: integer(data['interventionOrders']),
    waitingMerchantOrders: integer(data['waitingMerchantOrders']),
    stuckOrders: integer(data['stuckOrders']),
    unassignedDeliveries: integer(data['unassignedDeliveries']),
    searchingDeliveries: integer(data['searchingDeliveries']),
    activeDeliveries: integer(data['activeDeliveries']),
    alertAttention: integer(data['alertAttention']),
    paymentAttention: integer(data['paymentAttention']),
    refundAttention: integer(data['refundAttention']),
    openCases: integer(data['openCases']),
    suspendedMerchants: integer(data['suspendedMerchants']),
    suspendedCaptains: integer(data['suspendedCaptains']),
    generatedAt: string(data['generatedAt']),
  };
}

export function parseSearchResults(value: unknown): readonly AdminSearchResult[] {
  const raw = Array.isArray(value)
    ? value
    : (() => {
        const data = directOrEnvelope(value);
        return data['results'] ?? data['items'];
      })();
  return array(raw, 'search results').map((item) => {
    const candidate = record(item);
    const type = string(candidate['type']);
    if (!['ORDER', 'DELIVERY_TASK', 'MERCHANT', 'CAPTAIN', 'CASE'].includes(type)) {
      throw new AdminContractError('Unknown search result type');
    }
    return {
      type: type as AdminSearchResult['type'],
      id: string(candidate['id']),
      primaryText: string(candidate['primaryText']),
      secondaryText: string(candidate['secondaryText']),
      status: string(candidate['status']),
      updatedAt: string(candidate['updatedAt']),
    };
  });
}

function parseOrder(item: unknown): AdminOperationalOrder {
  const candidate = record(item);
  const shop = record(candidate['shop']);
  const customer = record(candidate['customer']);
  const attention = record(candidate['attention']);
  const deliveryValue = candidate['delivery'];
  const queue = string(candidate['operationalQueue']);
  if (
    ![
      'WAITING',
      'STUCK',
      'UNASSIGNED',
      'ACTIVE',
      'ALERT',
      'PAYMENT',
      'REFUND',
      'CASE',
      'PROBLEM',
    ].includes(queue)
  ) {
    throw new AdminContractError('Unknown operational queue');
  }
  return {
    id: string(candidate['id']),
    orderNumber: string(candidate['orderNumber']),
    orderStatus: string(candidate['orderStatus']),
    paymentStatus: string(candidate['paymentStatus']),
    fulfilmentType: string(candidate['fulfilmentType']),
    totalPaise: integer(candidate['totalPaise']),
    operationalQueue: queue as AdminOperationalOrder['operationalQueue'],
    shop: { id: string(shop['id']), name: string(shop['name']) },
    customer: {
      id: string(customer['id']),
      displayName: string(customer['displayName']),
      phoneLast4: nullableString(customer['phoneLast4']),
    },
    delivery:
      deliveryValue === null
        ? null
        : (() => {
            const delivery = record(deliveryValue);
            return {
              taskId: string(delivery['taskId']),
              status: string(delivery['status']),
              assignedCaptainId: nullableString(delivery['assignedCaptainId']),
              updatedAt: string(delivery['updatedAt']),
            };
          })(),
    attention: {
      alert: boolean(attention['alert']),
      payment: boolean(attention['payment']),
      refund: boolean(attention['refund']),
      case: boolean(attention['case']),
    },
    updatedAt: string(candidate['updatedAt']),
  };
}

export function parseOrderPage(value: unknown): AdminOrderPage {
  const data = envelopeData(value);
  return {
    orders: array(data['orders']).map(parseOrder),
    nextCursor: nullableString(data['nextCursor']),
  };
}

function parseAuditEntry(value: unknown): AdminAuditEntry {
  const item = record(value);
  const before = item['before'] ?? item['before_state'] ?? item['beforeState'];
  const after = item['after'] ?? item['after_state'] ?? item['afterState'];
  return {
    id: string(item['id']),
    actorId: string(item['actorId'] ?? item['actor_id']),
    action: string(item['action']),
    resourceType: string(item['resourceType'] ?? item['resource_type']),
    resourceId: string(item['resourceId'] ?? item['resource_id']),
    reasonCode: string(item['reasonCode'] ?? item['reason_code']),
    note: nullableString(item['note']),
    requestId: nullableString(item['requestId'] ?? item['request_id']),
    idempotencyKey: string(item['idempotencyKey'] ?? item['idempotency_key']),
    before: nullableRecord(before),
    after: nullableRecord(after),
    createdAt: string(item['createdAt'] ?? item['created_at']),
  };
}

function parseStatusHistory(value: unknown): AdminStatusHistoryEntry {
  const item = record(value);
  return {
    id: string(item['id']),
    previousStatus: nullableString(item['previousStatus']),
    newStatus: string(item['newStatus']),
    changedByRole: string(item['changedByRole']),
    reasonCode: nullableString(item['reasonCode']),
    note: nullableString(item['note']),
    createdAt: string(item['createdAt']),
  };
}

export function parseInvestigation(value: unknown): AdminOrderInvestigation {
  const data = directOrEnvelope(value);
  const order = record(data['order']);
  const customer = record(data['customer']);
  const deliveryValue = data['delivery'];
  return {
    order: {
      id: string(order['id']),
      orderNumber: string(order['orderNumber']),
      customerId: string(order['customerId']),
      shopId: string(order['shopId']),
      status: string(order['status']),
      paymentStatus: string(order['paymentStatus']),
      fulfilmentType: string(order['fulfilmentType']),
      totalPaise: integer(order['totalPaise']),
      placedAt: string(order['placedAt']),
      acceptedAt: nullableString(order['acceptedAt']),
      readyAt: nullableString(order['readyAt']),
      pickedUpAt: nullableString(order['pickedUpAt']),
      deliveredAt: nullableString(order['deliveredAt']),
      completedAt: nullableString(order['completedAt']),
      cancelledAt: nullableString(order['cancelledAt']),
      updatedAt: string(order['updatedAt']),
      version: integer(order['version']),
    },
    customer: {
      id: string(customer['id']),
      fullName: string(customer['fullName']),
      phoneNumber: string(customer['phoneNumber']),
      status: string(customer['status']),
    },
    statusHistory: array(data['statusHistory']).map(parseStatusHistory),
    delivery:
      deliveryValue === null
        ? null
        : (() => {
            const delivery = record(deliveryValue);
            return {
              taskId: string(delivery['taskId']),
              status: string(delivery['status']),
              assignedCaptainId: nullableString(delivery['assignedCaptainId']),
              assignmentAttempts: integer(delivery['assignmentAttempts']),
              assignedAt: nullableString(delivery['assignedAt']),
              pickedUpAt: nullableString(delivery['pickedUpAt']),
              completedAt: nullableString(delivery['completedAt']),
              updatedAt: string(delivery['updatedAt']),
            };
          })(),
    cases: array(data['cases']).map((value) => {
      const item = record(value);
      return {
        id: string(item['id']),
        ticketNumber: string(item['ticketNumber']),
        category: string(item['category']),
        priority: string(item['priority']),
        status: string(item['status']),
        subject: string(item['subject']),
        assignedTo: nullableString(item['assignedTo']),
        createdAt: string(item['createdAt']),
        updatedAt: string(item['updatedAt']),
      };
    }),
    audit: array(data['audit']).map(parseAuditEntry),
  };
}

function parseMerchantListItem(value: unknown): AdminMerchantListItem {
  const item = record(value);
  return {
    id: string(item['id']),
    fullName: string(item['fullName']),
    legalName: string(item['legalName']),
    phoneLast4: nullableString(item['phoneLast4']),
    profileStatus: string(item['profileStatus']),
    onboardingStatus: string(item['onboardingStatus']),
    kycStatus: string(item['kycStatus']),
    shopCount: integer(item['shopCount']),
    openOrders: integer(item['openOrders']),
    problemOrders30d: integer(item['problemOrders30d']),
    updatedAt: string(item['updatedAt']),
  };
}

export function parseMerchantPage(value: unknown): AdminMerchantPage {
  const data = envelopeData(value);
  return {
    merchants: array(data['merchants']).map(parseMerchantListItem),
    nextCursor: nullableString(data['nextCursor']),
  };
}

export function parseMerchantSnapshot(value: unknown): AdminMerchantSnapshot {
  const data = directOrEnvelope(value);
  const merchant = record(data['merchant']);
  const metrics = record(data['metrics']);
  return {
    merchant: {
      id: string(merchant['id']),
      fullName: string(merchant['fullName']),
      phoneNumber: string(merchant['phoneNumber']),
      profileStatus: string(merchant['profileStatus']),
      legalName: string(merchant['legalName']),
      onboardingStatus: string(merchant['onboardingStatus']),
      kycStatus: string(merchant['kycStatus']),
      updatedAt: string(merchant['updatedAt']),
    },
    shops: array(data['shops']).map((value) => {
      const shop = record(value);
      return {
        id: string(shop['id']),
        shopCode: string(shop['shopCode']),
        name: string(shop['name']),
        verificationStatus: string(shop['verificationStatus']),
        operationalStatus: string(shop['operationalStatus']),
        acceptsOnlineOrders: boolean(shop['acceptsOnlineOrders']),
        updatedAt: string(shop['updatedAt']),
      };
    }),
    metrics: {
      openOrders: integer(metrics['openOrders']),
      cancelledOrders30d: integer(metrics['cancelledOrders30d']),
      problemOrders30d: integer(metrics['problemOrders30d']),
    },
  };
}

function parseCaptainListItem(value: unknown): AdminCaptainListItem {
  const item = record(value);
  return {
    id: string(item['id']),
    captainCode: string(item['captainCode']),
    fullName: string(item['fullName']),
    phoneLast4: nullableString(item['phoneLast4']),
    profileStatus: string(item['profileStatus']),
    kycStatus: string(item['kycStatus']),
    availabilityStatus: string(item['availabilityStatus']),
    vehicleType: nullableString(item['vehicleType']),
    ratingAverage: item['ratingAverage'] === null ? null : number(item['ratingAverage']),
    completedDeliveries: integer(item['completedDeliveries']),
    activeDeliveryTaskId: nullableString(item['activeDeliveryTaskId']),
    locationRecordedAt: nullableString(item['locationRecordedAt']),
    problemDeliveries30d: integer(item['problemDeliveries30d']),
    updatedAt: string(item['updatedAt']),
  };
}

export function parseCaptainPage(value: unknown): AdminCaptainPage {
  const data = envelopeData(value);
  return {
    captains: array(data['captains']).map(parseCaptainListItem),
    nextCursor: nullableString(data['nextCursor']),
  };
}

export function parseCaptainSnapshot(value: unknown): AdminCaptainSnapshot {
  const data = directOrEnvelope(value);
  const captain = record(data['captain']);
  const metrics = record(data['metrics']);
  const activeValue = data['activeDelivery'];
  const locationValue = data['location'];
  return {
    captain: {
      id: string(captain['id']),
      captainCode: string(captain['captainCode']),
      fullName: string(captain['fullName']),
      phoneNumber: string(captain['phoneNumber']),
      profileStatus: string(captain['profileStatus']),
      kycStatus: string(captain['kycStatus']),
      availabilityStatus: string(captain['availabilityStatus']),
      vehicleType: nullableString(captain['vehicleType']),
      vehicleNumber: nullableString(captain['vehicleNumber']),
      ratingAverage: captain['ratingAverage'] === null ? null : number(captain['ratingAverage']),
      ratingCount: integer(captain['ratingCount']),
      completedDeliveries: integer(captain['completedDeliveries']),
      cashBalancePaise: integer(captain['cashBalancePaise']),
      approvedAt: nullableString(captain['approvedAt']),
      updatedAt: string(captain['updatedAt']),
    },
    activeDelivery:
      activeValue === null
        ? null
        : (() => {
            const active = record(activeValue);
            return {
              taskId: string(active['taskId']),
              orderId: string(active['orderId']),
              status: string(active['status']),
              assignedAt: nullableString(active['assignedAt']),
              pickedUpAt: nullableString(active['pickedUpAt']),
              problemReportedAt: nullableString(active['problemReportedAt']),
            };
          })(),
    location:
      locationValue === null
        ? null
        : (() => {
            const location = record(locationValue);
            return {
              latitude: number(location['latitude']),
              longitude: number(location['longitude']),
              accuracyMeters: number(location['accuracyMeters']),
              recordedAt: string(location['recordedAt']),
              activeDeliveryTaskId: nullableString(location['activeDeliveryTaskId']),
              updatedAt: string(location['updatedAt']),
            };
          })(),
    metrics: {
      problemDeliveries30d: integer(metrics['problemDeliveries30d']),
      pendingEarningsPaise: integer(metrics['pendingEarningsPaise']),
    },
  };
}

export function parseAudit(value: unknown): readonly AdminAuditEntry[] {
  if (Array.isArray(value)) return value.map(parseAuditEntry);
  const raw = directOrEnvelope(value);
  const entries = raw['entries'] ?? raw['audit'];
  if (Array.isArray(entries)) return entries.map(parseAuditEntry);
  throw new AdminContractError('Expected audit entries');
}

export function parseOperationOutcome(value: unknown): AdminOperationOutcome {
  const data = directOrEnvelope(value);
  const summary: Record<string, string | number | boolean | null> = {};
  for (const [key, candidate] of Object.entries(data)) {
    if (
      candidate === null ||
      typeof candidate === 'string' ||
      typeof candidate === 'number' ||
      typeof candidate === 'boolean'
    ) {
      summary[key] = candidate;
    }
  }
  return { replayed: data['replayed'] === true, summary };
}

const ADMIN_MARKET_STATUSES = [
  'DRAFT',
  'CONFIGURING',
  'READY_FOR_VALIDATION',
  'ACTIVE',
  'PAUSED',
  'CLOSED',
] as const;

function marketStatus(value: unknown): AdminMarketLifecycleStatus {
  const parsed = string(value, 'market lifecycle status');
  if (!ADMIN_MARKET_STATUSES.includes(parsed as AdminMarketLifecycleStatus)) {
    throw new AdminContractError('Unknown market lifecycle status');
  }
  return parsed as AdminMarketLifecycleStatus;
}

function objectMap(value: unknown, label: string): Readonly<Record<string, unknown>> {
  return record(value, label);
}

export function parseCityPreflightReport(value: unknown): AdminCityPreflightReport {
  const item = directOrEnvelope(value);
  const rawChecks = record(item['checks'], 'preflight checks');
  const checks: Record<string, Readonly<Record<string, unknown>>> = {};
  for (const [key, check] of Object.entries(rawChecks)) checks[key] = record(check, key);
  return {
    id: string(item['id']),
    cityId: string(item['cityId']),
    cityConfigurationVersion: integer(item['cityConfigurationVersion']),
    readinessVersion: integer(item['readinessVersion']),
    cityStatus: marketStatus(item['cityStatus']),
    checks,
    passed: boolean(item['passed']),
    createdAt: string(item['createdAt']),
  };
}

export function parseCityControlPlane(value: unknown): AdminCityControlPlane {
  const data = directOrEnvelope(value);
  const city = record(data['city'], 'city');
  const configuration = record(data['configuration'], 'city configuration');
  const readiness = record(data['readiness'], 'city readiness');
  const latest = data['latestPreflight'];
  return {
    city: {
      id: string(city['id']),
      code: string(city['code']),
      slug: string(city['slug']),
      name: string(city['name']),
      stateCode: string(city['stateCode']),
      countryCode: string(city['countryCode']),
      status: marketStatus(city['status']),
      activatedAt: nullableString(city['activatedAt']),
      pausedAt: nullableString(city['pausedAt']),
      closedAt: nullableString(city['closedAt']),
      updatedAt: string(city['updatedAt']),
    },
    configuration: {
      cityId: string(configuration['cityId']),
      timezone: string(configuration['timezone']),
      defaultCodLimitPaise: integer(configuration['defaultCodLimitPaise']),
      defaultDeliveryRadiusMeters: integer(configuration['defaultDeliveryRadiusMeters']),
      maximumDeliveryRadiusMeters: integer(configuration['maximumDeliveryRadiusMeters']),
      baseDeliveryFeePaise: integer(configuration['baseDeliveryFeePaise']),
      perKmDeliveryFeePaise: integer(configuration['perKmDeliveryFeePaise']),
      merchantCommissionBps: integer(configuration['merchantCommissionBps']),
      localDeliveryEnabled: boolean(configuration['localDeliveryEnabled']),
      postalDeliveryEnabled: boolean(configuration['postalDeliveryEnabled']),
      operatingHours: objectMap(configuration['operatingHours'], 'operating hours'),
      holidayDates: array(configuration['holidayDates'], 'holiday dates').map((item) =>
        string(item, 'holiday date'),
      ),
      cancellationPolicy: objectMap(configuration['cancellationPolicy'], 'cancellation policy'),
      refundPolicy: objectMap(configuration['refundPolicy'], 'refund policy'),
      version: integer(configuration['version']),
      updatedAt: string(configuration['updatedAt']),
    },
    readiness: {
      cityId: string(readiness['cityId']),
      activeCaptainCount: integer(readiness['activeCaptainCount']),
      standbyCaptainCount: integer(readiness['standbyCaptainCount']),
      paymentProviderHealthy: boolean(readiness['paymentProviderHealthy']),
      smsOtpProviderHealthy: boolean(readiness['smsOtpProviderHealthy']),
      fcmProviderHealthy: boolean(readiness['fcmProviderHealthy']),
      observabilityHealthy: boolean(readiness['observabilityHealthy']),
      validationOrderId: nullableString(readiness['validationOrderId']),
      unresolvedHighBlockers: integer(readiness['unresolvedHighBlockers']),
      version: integer(readiness['version']),
      updatedAt: string(readiness['updatedAt']),
    },
    zones: array(data['zones'], 'service zones').map((zoneValue) => {
      const zone = record(zoneValue, 'service zone');
      const radius = zone['defaultDeliveryRadiusMeters'];
      return {
        id: string(zone['id']),
        cityId: string(zone['cityId']),
        code: string(zone['code']),
        slug: string(zone['slug']),
        name: string(zone['name']),
        status: marketStatus(zone['status']),
        defaultDeliveryRadiusMeters: radius === null ? null : integer(radius),
        version: integer(zone['version']),
        updatedAt: string(zone['updatedAt']),
        pincodes: array(zone['pincodes'], 'zone pincodes').map((pincodeValue) => {
          const pincode = record(pincodeValue, 'zone pincode');
          return {
            id: string(pincode['id']),
            pincode: string(pincode['pincode']),
            priority: integer(pincode['priority']),
            isPrimary: boolean(pincode['isPrimary']),
            isActive: boolean(pincode['isActive']),
            version: integer(pincode['version']),
          };
        }),
      };
    }),
    latestPreflight: latest === null ? null : parseCityPreflightReport(latest),
  };
}

export function parseCityList(value: unknown): readonly AdminCityControlPlane[] {
  const raw = Array.isArray(value)
    ? value
    : (() => {
        const data = directOrEnvelope(value);
        return data['items'] ?? data['cities'];
      })();
  return array(raw, 'city control planes').map(parseCityControlPlane);
}

export function parseCityMutationResult(value: unknown): AdminCityMutationResult {
  const data = directOrEnvelope(value);
  return {
    replayed: data['replayed'] === true,
    controlPlane: parseCityControlPlane(data['controlPlane']),
  };
}

export function parseCityPreflightResult(value: unknown): AdminCityPreflightReport {
  const data = directOrEnvelope(value);
  return parseCityPreflightReport(data['report']);
}
