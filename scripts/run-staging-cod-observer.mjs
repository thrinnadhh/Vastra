import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { STAGING_COD_STEPS } from './pilot-execution-report-lib.mjs';

const ORDER_STATUS_ORDER = [
  'PAYMENT_PENDING',
  'WAITING_FOR_MERCHANT',
  'MERCHANT_ACCEPTED',
  'PACKING',
  'READY_FOR_PICKUP',
  'CAPTAIN_SEARCHING',
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_AT_STORE',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'CAPTAIN_AT_CUSTOMER',
  'DELIVERED',
  'COMPLETED',
];

function requiredEnvironment(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function optionalPositiveInteger(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be positive.`);
  return parsed;
}

function validateBaseUrl(value) {
  const url = new URL(value);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (!local && url.protocol !== 'https:') throw new Error('PILOT_API_BASE_URL must use HTTPS.');
  if (url.hostname === 'api.vastra.in') {
    throw new Error('The staging observer refuses the production Vastra API host.');
  }
  return value.replace(/\/+$/u, '');
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestId(value) {
  if (!isRecord(value)) return null;
  if (isRecord(value.meta) && typeof value.meta.requestId === 'string') return value.meta.requestId;
  return typeof value.requestId === 'string' ? value.requestId : null;
}

function dataRecord(value) {
  return isRecord(value) && value.success === true && isRecord(value.data) ? value.data : null;
}

function nestedRecord(record, key) {
  return isRecord(record?.[key]) ? record[key] : null;
}

function stringValue(record, key) {
  return typeof record?.[key] === 'string' ? record[key] : null;
}

function historyStatuses(order) {
  if (!Array.isArray(order?.history)) return [];
  return order.history
    .map((entry) => (isRecord(entry) ? stringValue(entry, 'status') : null))
    .filter((status) => status !== null);
}

function hasReached(statuses, expected) {
  const expectedIndex = ORDER_STATUS_ORDER.indexOf(expected);
  return statuses.some((status) => ORDER_STATUS_ORDER.indexOf(status) >= expectedIndex);
}

function now() {
  return new Date().toISOString();
}

function sleep(delayMs) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
}

function createReport(releaseCommit, orderId, operator) {
  return {
    schemaVersion: 1,
    type: 'staging-cod',
    releaseCommit,
    environment: 'staging',
    status: 'IN_PROGRESS',
    startedAt: now(),
    completedAt: null,
    operator,
    orderId,
    notes:
      'Authoritative projections are being observed while operators execute the real staging journey.',
    steps: STAGING_COD_STEPS.map((id) => ({
      id,
      status: 'NOT_RUN',
      observedAt: null,
      requestIds: [],
      evidence: [],
      notes: 'Not observed yet.',
    })),
  };
}

function pass(report, id, evidenceRequestId, notes) {
  const step = report.steps.find((candidate) => candidate.id === id);
  if (step === undefined || step.status === 'PASS') return;
  step.status = 'PASS';
  step.observedAt = now();
  step.notes = notes;
  if (evidenceRequestId !== null && !step.requestIds.includes(evidenceRequestId)) {
    step.requestIds.push(evidenceRequestId);
  }
}

async function readProjection(baseUrl, path, token) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: error instanceof Error ? error.message : 'Transport failure',
    };
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    return { ok: false, status: response.status, body: null, error: 'Malformed JSON response' };
  }
  return {
    ok: response.ok,
    status: response.status,
    body,
    error: response.ok ? null : `HTTP ${response.status}`,
  };
}

function applyMerchantProjection(report, projection, packingProjection) {
  if (!projection.ok) return;
  const request = requestId(projection.body);
  const order = nestedRecord(dataRecord(projection.body), 'order');
  if (order === null) return;
  const currentStatus = stringValue(order, 'status');
  const statuses = [...historyStatuses(order), currentStatus].filter((status) => status !== null);
  const alert = nestedRecord(order, 'alert');

  pass(
    report,
    'customer-order-created',
    request,
    'Merchant projection contains the authoritative order.',
  );
  if (alert !== null && ['DELIVERED', 'ACKNOWLEDGED'].includes(stringValue(alert, 'status'))) {
    pass(
      report,
      'merchant-alert-received',
      request,
      'Merchant alert reached a delivered or acknowledged state.',
    );
  }
  if (hasReached(statuses, 'MERCHANT_ACCEPTED')) {
    pass(report, 'merchant-order-accepted', request, 'Order history reached MERCHANT_ACCEPTED.');
  }
  if (hasReached(statuses, 'PACKING')) {
    pass(report, 'merchant-packing-started', request, 'Order history reached PACKING.');
  }
  if (hasReached(statuses, 'READY_FOR_PICKUP')) {
    pass(report, 'merchant-ready-for-pickup', request, 'Order history reached READY_FOR_PICKUP.');
  }

  if (packingProjection.ok) {
    const packingRequest = requestId(packingProjection.body);
    const packingList = nestedRecord(dataRecord(packingProjection.body), 'packingList');
    if (packingList?.allVerified === true) {
      pass(
        report,
        'merchant-items-verified',
        packingRequest,
        'Authoritative packing projection reports allVerified=true.',
      );
    }
  }

  if (hasReached(statuses, 'CAPTAIN_SEARCHING')) {
    pass(report, 'captain-offer-received', request, 'Dispatch entered CAPTAIN_SEARCHING.');
  }
  if (hasReached(statuses, 'CAPTAIN_ASSIGNED')) {
    pass(report, 'captain-offer-accepted', request, 'Order history reached CAPTAIN_ASSIGNED.');
  }
  if (hasReached(statuses, 'CAPTAIN_AT_STORE')) {
    pass(report, 'captain-arrived-at-store', request, 'Order history reached CAPTAIN_AT_STORE.');
  }
  if (hasReached(statuses, 'PICKED_UP')) {
    pass(report, 'pickup-code-verified', request, 'Order history reached PICKED_UP.');
  }
  if (hasReached(statuses, 'OUT_FOR_DELIVERY')) {
    pass(report, 'captain-departed-store', request, 'Order history reached OUT_FOR_DELIVERY.');
  }
  if (hasReached(statuses, 'CAPTAIN_AT_CUSTOMER')) {
    pass(
      report,
      'captain-arrived-at-customer',
      request,
      'Order history reached CAPTAIN_AT_CUSTOMER.',
    );
  }
  if (hasReached(statuses, 'DELIVERED')) {
    pass(
      report,
      'cod-and-delivery-otp-completed',
      request,
      'Atomic delivery completion moved the order to DELIVERED.',
    );
  }
}

function applyCaptainProjection(report, offersProjection, activeProjection, orderId) {
  if (offersProjection.ok) {
    const request = requestId(offersProjection.body);
    const offers = dataRecord(offersProjection.body)?.offers;
    if (
      Array.isArray(offers) &&
      offers.some((offer) => isRecord(offer) && stringValue(offer, 'orderId') === orderId)
    ) {
      pass(
        report,
        'captain-offer-received',
        request,
        'Captain offer list contains the target order.',
      );
    }
  }

  if (!activeProjection.ok) return;
  const request = requestId(activeProjection.body);
  const delivery = nestedRecord(dataRecord(activeProjection.body), 'delivery');
  if (delivery === null || stringValue(delivery, 'orderId') !== orderId) return;
  const taskStatus = stringValue(delivery, 'taskStatus');
  const assignmentStatus = stringValue(delivery, 'assignmentStatus');

  if (assignmentStatus === 'ACCEPTED') {
    pass(report, 'captain-offer-accepted', request, 'Active delivery has an accepted assignment.');
  }
  if (['AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROP'].includes(taskStatus)) {
    pass(
      report,
      'captain-arrived-at-store',
      request,
      'Captain task reached the merchant location.',
    );
  }
  if (['PICKED_UP', 'IN_TRANSIT', 'AT_DROP'].includes(taskStatus)) {
    pass(report, 'pickup-code-verified', request, 'Captain task confirms verified pickup custody.');
  }
  if (['IN_TRANSIT', 'AT_DROP'].includes(taskStatus)) {
    pass(report, 'captain-departed-store', request, 'Captain task is in transit.');
  }
  if (taskStatus === 'AT_DROP') {
    pass(report, 'captain-arrived-at-customer', request, 'Captain task reached the customer.');
  }
}

function applyCustomerProjection(report, orderProjection, trackingProjection) {
  if (orderProjection.ok) {
    const request = requestId(orderProjection.body);
    const order = nestedRecord(dataRecord(orderProjection.body), 'order');
    const status = stringValue(order, 'status');
    if (status !== null) {
      pass(report, 'customer-order-created', request, 'Customer can read the authoritative order.');
    }
    if (status === 'DELIVERED' || status === 'COMPLETED') {
      pass(
        report,
        'customer-delivered-observed',
        request,
        'Customer order projection reports successful delivery.',
      );
    }
  }

  if (!trackingProjection.ok) return;
  const request = requestId(trackingProjection.body);
  const tracking = nestedRecord(dataRecord(trackingProjection.body), 'tracking');
  if (['DELIVERED', 'COMPLETED'].includes(stringValue(tracking, 'orderStatus'))) {
    pass(
      report,
      'customer-delivered-observed',
      request,
      'Customer tracking projection reports successful delivery.',
    );
  }
}

function writeReport(report, outputPath) {
  const absolutePath = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

try {
  const baseUrl = validateBaseUrl(requiredEnvironment('PILOT_API_BASE_URL'));
  const customerToken = requiredEnvironment('PILOT_CUSTOMER_TOKEN');
  const merchantToken = requiredEnvironment('PILOT_MERCHANT_TOKEN');
  const captainToken = requiredEnvironment('PILOT_CAPTAIN_TOKEN');
  const orderId = requiredEnvironment('PILOT_ORDER_ID');
  const releaseCommit = requiredEnvironment('PILOT_RELEASE_COMMIT');
  const operator = requiredEnvironment('PILOT_OPERATOR');
  const outputPath = requiredEnvironment('PILOT_REPORT_PATH');
  const pollIntervalMs = optionalPositiveInteger('PILOT_POLL_INTERVAL_MS', 5_000);
  const timeoutMs = optionalPositiveInteger('PILOT_TIMEOUT_MS', 30 * 60 * 1_000);
  const report = createReport(releaseCommit, orderId, operator);
  const deadline = Date.now() + timeoutMs;

  writeReport(report, outputPath);
  while (Date.now() < deadline) {
    const [
      customerOrder,
      customerTracking,
      merchantOrder,
      merchantPacking,
      captainOffers,
      captainActive,
    ] = await Promise.all([
      readProjection(baseUrl, `/customer/orders/${encodeURIComponent(orderId)}`, customerToken),
      readProjection(
        baseUrl,
        `/customer/orders/${encodeURIComponent(orderId)}/tracking`,
        customerToken,
      ),
      readProjection(baseUrl, `/merchant/orders/${encodeURIComponent(orderId)}`, merchantToken),
      readProjection(
        baseUrl,
        `/merchant/orders/${encodeURIComponent(orderId)}/packing`,
        merchantToken,
      ),
      readProjection(baseUrl, '/captain/delivery-offers', captainToken),
      readProjection(baseUrl, '/captain/deliveries/active', captainToken),
    ]);

    applyMerchantProjection(report, merchantOrder, merchantPacking);
    applyCaptainProjection(report, captainOffers, captainActive, orderId);
    applyCustomerProjection(report, customerOrder, customerTracking);

    if (report.steps.every((step) => step.status === 'PASS')) {
      report.status = 'PASS';
      report.completedAt = now();
      report.notes =
        'All authoritative customer, merchant, and captain staging checkpoints were observed.';
      writeReport(report, outputPath);
      console.log(`OK: complete staging COD journey observed. Report: ${outputPath}`);
      break;
    }

    writeReport(report, outputPath);
    await sleep(pollIntervalMs);
  }

  if (report.status !== 'PASS') {
    report.status = 'BLOCKED';
    report.completedAt = now();
    report.notes = 'Observer timeout expired before every authoritative checkpoint was observed.';
    for (const step of report.steps) {
      if (step.status !== 'PASS') {
        step.status = 'BLOCKED';
        step.notes = 'Not observed before the configured timeout.';
      }
    }
    writeReport(report, outputPath);
    console.error(`BLOCKED: staging COD observer timed out. Report: ${outputPath}`);
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown staging observer failure';
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}
