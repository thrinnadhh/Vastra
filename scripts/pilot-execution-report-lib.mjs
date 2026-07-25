import { isAbsolute, relative, resolve } from 'node:path';

const REPORT_STATUSES = new Set(['NOT_RUN', 'IN_PROGRESS', 'PASS', 'FAIL', 'BLOCKED']);
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const STAGING_COD_STEPS = [
  'customer-order-created',
  'merchant-alert-received',
  'merchant-order-accepted',
  'merchant-packing-started',
  'merchant-items-verified',
  'merchant-ready-for-pickup',
  'captain-offer-received',
  'captain-offer-accepted',
  'captain-arrived-at-store',
  'pickup-code-verified',
  'captain-departed-store',
  'captain-arrived-at-customer',
  'cod-and-delivery-otp-completed',
  'customer-delivered-observed',
];

export const DEVICE_FCM_STEPS = [
  'merchant-foreground-alert',
  'merchant-background-alert',
  'merchant-killed-process-alert',
  'merchant-locked-screen-alert',
  'merchant-battery-saver-alert',
  'notification-permission-denied',
  'notification-permission-restored',
  'duplicate-fcm-delivery',
  'acknowledgement-stops-alert',
  'acknowledgement-network-retry',
  'restart-reconciles-active-alert',
  'captain-location-denied-restored',
  'captain-stale-offer-race',
  'captain-duplicate-confirmation',
];

export const ADMIN_RECOVERY_STEPS = [
  'investigate-order-timeline',
  'release-pre-pickup-assignment',
  'resolve-post-pickup-custody',
  'reset-delivery-verification-lockout',
  'pause-and-restore-merchant-orders',
  'suspend-and-restore-captain',
  'correct-captain-availability',
  'open-assign-escalate-resolve-case',
  'reconcile-cod-collection',
  'verify-immutable-audit-history',
  'verify-unauthorized-admin-denial',
];

export const LOAD_QUERY_SCENARIOS = [
  'nearby-shop-discovery',
  'product-search',
  'customer-order-read',
  'merchant-order-queue',
  'captain-offer-read',
  'checkout-quote',
  'cod-order-idempotency',
  'merchant-decision-race',
  'captain-assignment-race',
  'pickup-delivery-retry',
  'outbox-worker-contention',
];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDateTime(value) {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validEvidencePath(repositoryRoot, evidencePath) {
  if (!isNonEmptyString(evidencePath) || isAbsolute(evidencePath)) return false;
  const resolvedPath = resolve(repositoryRoot, evidencePath);
  const relativePath = relative(repositoryRoot, resolvedPath);
  return (
    relativePath.length > 0 &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  );
}

function validateCommon(report, errors) {
  if (!isRecord(report)) return;
  if (report.schemaVersion !== 1) errors.push('schemaVersion must equal 1.');
  if (!SHA_PATTERN.test(report.releaseCommit ?? '')) {
    errors.push('releaseCommit must be a full lowercase 40-character Git SHA.');
  }
  if (report.environment !== 'staging') errors.push('environment must equal staging.');
  if (!REPORT_STATUSES.has(report.status)) errors.push('status is invalid.');
  if (!isIsoDateTime(report.startedAt)) errors.push('startedAt must be an ISO date-time.');
  if (report.completedAt !== null && !isIsoDateTime(report.completedAt)) {
    errors.push('completedAt must be null or an ISO date-time.');
  }
  if (!isNonEmptyString(report.operator)) errors.push('operator must be a non-empty string.');
  if (!isNonEmptyString(report.notes)) errors.push('notes must be a non-empty string.');
}

function validateExactSteps(
  report,
  requiredIds,
  errors,
  { repositoryRoot, evidenceExists, requirePassEvidence = true },
) {
  if (!Array.isArray(report.steps)) {
    errors.push('steps must be an array.');
    return [];
  }

  const seen = new Set();
  const steps = [];
  for (const [index, step] of report.steps.entries()) {
    const prefix = `steps[${index}]`;
    if (!isRecord(step)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    steps.push(step);
    if (!isNonEmptyString(step.id)) {
      errors.push(`${prefix}.id must be a non-empty string.`);
    } else if (seen.has(step.id)) {
      errors.push(`${prefix}.id duplicates ${step.id}.`);
    } else {
      seen.add(step.id);
    }
    if (!REPORT_STATUSES.has(step.status)) errors.push(`${prefix}.status is invalid.`);
    if (step.observedAt !== null && !isIsoDateTime(step.observedAt)) {
      errors.push(`${prefix}.observedAt must be null or an ISO date-time.`);
    }
    if (!Array.isArray(step.requestIds)) {
      errors.push(`${prefix}.requestIds must be an array.`);
    } else if (step.requestIds.some((value) => !isNonEmptyString(value))) {
      errors.push(`${prefix}.requestIds must contain only non-empty strings.`);
    }
    if (!Array.isArray(step.evidence)) {
      errors.push(`${prefix}.evidence must be an array.`);
    } else {
      for (const evidencePath of step.evidence) {
        if (!validEvidencePath(repositoryRoot, evidencePath)) {
          errors.push(`${prefix}.evidence contains an unsafe repository path.`);
        } else if (step.status === 'PASS' && !evidenceExists(evidencePath)) {
          errors.push(`${prefix}.evidence does not exist: ${evidencePath}`);
        }
      }
    }
    if (!isNonEmptyString(step.notes)) errors.push(`${prefix}.notes must be a non-empty string.`);
    if (step.status === 'PASS' && step.observedAt === null) {
      errors.push(`${prefix} cannot be PASS without observedAt.`);
    }
    if (
      requirePassEvidence &&
      step.status === 'PASS' &&
      (step.requestIds?.length ?? 0) === 0 &&
      (step.evidence?.length ?? 0) === 0
    ) {
      errors.push(`${prefix} cannot be PASS without request IDs or evidence.`);
    }
  }

  for (const requiredId of requiredIds) {
    if (!seen.has(requiredId)) errors.push(`Required step is missing: ${requiredId}.`);
  }
  if (seen.size !== requiredIds.length || report.steps.length !== requiredIds.length) {
    errors.push('steps must contain exactly the required execution steps.');
  }
  return steps;
}

function validateFinalPass(report, steps, errors) {
  if (report.status !== 'PASS') return;
  if (report.completedAt === null) errors.push('PASS requires completedAt.');
  if (steps.some((step) => step.status !== 'PASS')) {
    errors.push('Report cannot be PASS unless every required step is PASS.');
  }
}

function validateStagingCod(report, context) {
  const errors = [];
  validateCommon(report, errors);
  if (report.type !== 'staging-cod') errors.push('type must equal staging-cod.');
  if (!UUID_PATTERN.test(report.orderId ?? '')) errors.push('orderId must be a UUID.');
  const steps = validateExactSteps(report, STAGING_COD_STEPS, errors, context);
  validateFinalPass(report, steps, errors);

  const observedTimes = steps
    .filter((step) => step.status === 'PASS' && step.observedAt !== null)
    .map((step) => Date.parse(step.observedAt));
  for (let index = 1; index < observedTimes.length; index += 1) {
    if (observedTimes[index] < observedTimes[index - 1]) {
      errors.push('Passed staging COD steps must have monotonic observedAt timestamps.');
      break;
    }
  }
  return errors;
}

function validateDeviceFcm(report, context) {
  const errors = [];
  validateCommon(report, errors);
  if (report.type !== 'device-fcm') errors.push('type must equal device-fcm.');
  const steps = validateExactSteps(report, DEVICE_FCM_STEPS, errors, context);
  validateFinalPass(report, steps, errors);

  if (!Array.isArray(report.devices) || report.devices.length < 3) {
    errors.push('devices must contain at least three physical Android devices.');
  } else {
    const physicalDevices = report.devices.filter((device) => isRecord(device) && device.physical === true);
    const classes = new Set(physicalDevices.map((device) => device.class));
    const oems = new Set(physicalDevices.map((device) => device.oem));
    for (const requiredClass of ['low-memory', 'current-android', 'minimum-supported-android']) {
      if (!classes.has(requiredClass)) errors.push(`Physical device class is missing: ${requiredClass}.`);
    }
    if (oems.size < 2) errors.push('Physical evidence must cover at least two Android OEMs.');
    for (const [index, device] of report.devices.entries()) {
      if (!isRecord(device)) {
        errors.push(`devices[${index}] must be an object.`);
        continue;
      }
      if (!isNonEmptyString(device.model) || !isNonEmptyString(device.oem)) {
        errors.push(`devices[${index}] requires model and oem.`);
      }
      if (!isNonEmptyString(device.androidVersion) || !isNonEmptyString(device.buildId)) {
        errors.push(`devices[${index}] requires androidVersion and buildId.`);
      }
    }
  }

  if (!Array.isArray(report.providerTimelines) || report.providerTimelines.length === 0) {
    errors.push('providerTimelines must contain at least one real FCM delivery timeline.');
  } else {
    for (const [index, timeline] of report.providerTimelines.entries()) {
      const prefix = `providerTimelines[${index}]`;
      if (!isRecord(timeline)) {
        errors.push(`${prefix} must be an object.`);
        continue;
      }
      const fields = [
        'alertCreatedAt',
        'providerAcceptedAt',
        'deviceReceivedAt',
        'uiPresentedAt',
        'acknowledgedAt',
      ];
      const times = [];
      for (const field of fields) {
        if (!isIsoDateTime(timeline[field])) errors.push(`${prefix}.${field} must be an ISO date-time.`);
        else times.push(Date.parse(timeline[field]));
      }
      for (let timeIndex = 1; timeIndex < times.length; timeIndex += 1) {
        if (times[timeIndex] < times[timeIndex - 1]) {
          errors.push(`${prefix} timestamps must be monotonic.`);
          break;
        }
      }
      if (!isNonEmptyString(timeline.providerMessageIdHash)) {
        errors.push(`${prefix}.providerMessageIdHash must contain a redacted hash.`);
      }
    }
  }
  return errors;
}

function validateLoadQuery(report, context) {
  const errors = [];
  validateCommon(report, errors);
  if (report.type !== 'load-query') errors.push('type must equal load-query.');
  const steps = validateExactSteps(report, LOAD_QUERY_SCENARIOS, errors, context);
  validateFinalPass(report, steps, errors);

  if (!isRecord(report.dataset)) {
    errors.push('dataset must be an object.');
  } else {
    const minimums = { shops: 100, products: 1000, variants: 3000, orders: 1000, captains: 100 };
    for (const [key, minimum] of Object.entries(minimums)) {
      if (!isNonNegativeInteger(report.dataset[key]) || report.dataset[key] < minimum) {
        errors.push(`dataset.${key} must be at least ${minimum}.`);
      }
    }
  }

  if (!isRecord(report.metrics)) {
    errors.push('metrics must be an object.');
  } else {
    if (typeof report.metrics.criticalReadSuccessRate !== 'number' || report.metrics.criticalReadSuccessRate < 0.999) {
      errors.push('criticalReadSuccessRate must be at least 0.999.');
    }
    if (typeof report.metrics.criticalCommandSuccessRate !== 'number' || report.metrics.criticalCommandSuccessRate < 0.995) {
      errors.push('criticalCommandSuccessRate must be at least 0.995.');
    }
    if (typeof report.metrics.p95CriticalReadMs !== 'number' || report.metrics.p95CriticalReadMs > 750) {
      errors.push('p95CriticalReadMs must be at most 750.');
    }
    if (typeof report.metrics.p95CriticalCommandMs !== 'number' || report.metrics.p95CriticalCommandMs > 1500) {
      errors.push('p95CriticalCommandMs must be at most 1500.');
    }
    if (report.metrics.invariantViolations !== 0) errors.push('invariantViolations must equal 0.');
  }
  return errors;
}

function validateAdminRecovery(report, context) {
  const errors = [];
  validateCommon(report, errors);
  if (report.type !== 'admin-recovery') errors.push('type must equal admin-recovery.');
  const steps = validateExactSteps(report, ADMIN_RECOVERY_STEPS, errors, context);
  validateFinalPass(report, steps, errors);
  if (report.status === 'PASS' && report.aal !== 'AAL2') errors.push('Admin recovery PASS requires AAL2.');
  if (report.status === 'PASS' && report.auditEntriesVerified !== true) {
    errors.push('Admin recovery PASS requires auditEntriesVerified=true.');
  }
  return errors;
}

export function validatePilotExecutionReport(
  report,
  { repositoryRoot = process.cwd(), evidenceExists = () => true } = {},
) {
  if (!isRecord(report)) return ['Pilot execution report must be a JSON object.'];
  const context = { repositoryRoot, evidenceExists };
  switch (report.type) {
    case 'staging-cod':
      return validateStagingCod(report, context);
    case 'device-fcm':
      return validateDeviceFcm(report, context);
    case 'load-query':
      return validateLoadQuery(report, context);
    case 'admin-recovery':
      return validateAdminRecovery(report, context);
    default:
      return ['type must be staging-cod, device-fcm, load-query, or admin-recovery.'];
  }
}
