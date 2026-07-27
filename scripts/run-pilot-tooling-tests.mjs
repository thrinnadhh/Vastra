import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isClientSourcePath, scanClientSource } from './client-secret-scan-lib.mjs';
import { validatePilotManifest } from './pilot-evidence-lib.mjs';
import {
  ADMIN_RECOVERY_STEPS,
  DEVICE_FCM_STEPS,
  LOAD_QUERY_SCENARIOS,
  STAGING_COD_STEPS,
  validatePilotExecutionReport,
} from './pilot-execution-report-lib.mjs';

const REQUIRED_IDS = [
  'S11-02-ACCEPTANCE',
  'S11-03-SECURITY',
  'S11-04-RLS',
  'S11-05-LOAD',
  'S11-06-DEVICE',
  'S11-07-FINANCE-DRILLS',
  'S11-08-BACKUP-RESTORE',
  'S11-09-OBSERVABILITY',
  'S11-10-RUNBOOKS',
  'S11-11-DEPLOYMENT',
  'S11-12-DEFECTS',
];

function buildManifest() {
  return {
    schemaVersion: 1,
    pilot: 'tirupati-limited',
    releaseCommit: null,
    decision: 'NOT_ASSESSED',
    decisionNotes: 'Evidence collection is incomplete.',
    signOff: {
      productOwner: null,
      engineeringOwner: null,
      operationsOwner: null,
    },
    checks: REQUIRED_IDS.map((id) => ({
      id,
      category: 'test',
      severity: id === 'S11-05-LOAD' ? 'HIGH' : 'CRITICAL',
      status: 'NOT_RUN',
      owner: 'engineering',
      evidence: [],
      notes: 'Not executed.',
    })),
    openDefects: [],
  };
}

function buildSteps(ids, status = 'NOT_RUN') {
  return ids.map((id, index) => ({
    id,
    status,
    observedAt:
      status === 'PASS' ? new Date(Date.UTC(2026, 6, 25, 10, 0, index)).toISOString() : null,
    requestIds: status === 'PASS' ? [`request-${index}`] : [],
    evidence: [],
    notes: status === 'PASS' ? 'Observed and verified.' : 'Not executed.',
  }));
}

function baseExecutionReport(type, steps, overrides = {}) {
  return {
    schemaVersion: 1,
    type,
    releaseCommit: 'a'.repeat(40),
    environment: 'staging',
    status: 'NOT_RUN',
    startedAt: '2026-07-25T10:00:00.000Z',
    completedAt: null,
    operator: 'Pilot Operator',
    notes: 'Not executed.',
    steps,
    ...overrides,
  };
}

function readTemplate(path) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'));
}

function runEvidenceTests() {
  const draftManifest = buildManifest();
  assert.deepEqual(validatePilotManifest(draftManifest), []);

  const missingEvidenceManifest = buildManifest();
  missingEvidenceManifest.checks[0].status = 'PASS';
  missingEvidenceManifest.checks[0].notes = 'Passed.';
  assert.ok(
    validatePilotManifest(missingEvidenceManifest).some((error) =>
      error.includes('cannot be PASS without evidence'),
    ),
  );

  const unsignedGoManifest = buildManifest();
  unsignedGoManifest.releaseCommit = 'a'.repeat(40);
  unsignedGoManifest.decision = 'GO';
  unsignedGoManifest.checks = unsignedGoManifest.checks.map((check) => ({
    ...check,
    status: 'PASS',
    evidence: [`docs/pilot/reports/${check.id}.md`],
  }));
  assert.ok(
    validatePilotManifest(unsignedGoManifest, { evidenceExists: () => true }).some((error) =>
      error.includes('requires product, engineering, and operations sign-off'),
    ),
  );

  const signedGoManifest = structuredClone(unsignedGoManifest);
  signedGoManifest.signOff = {
    productOwner: 'Product Owner',
    engineeringOwner: 'Engineering Owner',
    operationsOwner: 'Operations Owner',
  };
  assert.deepEqual(
    validatePilotManifest(signedGoManifest, {
      evidenceExists: () => true,
      enforceGo: true,
    }),
    [],
  );
}

function runExecutionReportTests() {
  const stagingTemplate = readTemplate(
    'docs/pilot/evidence/templates/staging-cod-report.template.json',
  );
  const deviceTemplate = readTemplate(
    'docs/pilot/evidence/templates/device-fcm-report.template.json',
  );
  const adminTemplate = readTemplate(
    'docs/pilot/evidence/templates/admin-recovery-report.template.json',
  );
  assert.deepEqual(validatePilotExecutionReport(stagingTemplate), []);
  assert.deepEqual(validatePilotExecutionReport(deviceTemplate), []);
  assert.deepEqual(validatePilotExecutionReport(adminTemplate), []);

  const falseStagingPass = baseExecutionReport(
    'staging-cod',
    buildSteps(STAGING_COD_STEPS, 'PASS').map((step) => ({
      ...step,
      requestIds: [],
    })),
    {
      status: 'PASS',
      completedAt: '2026-07-25T10:30:00.000Z',
      orderId: '00000000-0000-4000-8000-000000000001',
    },
  );
  assert.ok(
    validatePilotExecutionReport(falseStagingPass).some((error) =>
      error.includes('cannot be PASS without request IDs or evidence'),
    ),
  );

  const falseDevicePass = baseExecutionReport('device-fcm', buildSteps(DEVICE_FCM_STEPS, 'PASS'), {
    status: 'PASS',
    completedAt: '2026-07-25T11:00:00.000Z',
    devices: [],
    providerTimelines: [],
  });
  assert.ok(
    validatePilotExecutionReport(falseDevicePass).some((error) =>
      error.includes('at least three physical Android devices'),
    ),
  );

  const falseLoadPass = baseExecutionReport(
    'load-query',
    buildSteps(LOAD_QUERY_SCENARIOS, 'PASS'),
    {
      status: 'PASS',
      completedAt: '2026-07-25T11:00:00.000Z',
      dataset: { shops: 1, products: 1, variants: 1, orders: 1, captains: 1 },
      metrics: {
        criticalReadSuccessRate: 1,
        criticalCommandSuccessRate: 1,
        p95CriticalReadMs: 1,
        p95CriticalCommandMs: 1,
        invariantViolations: 0,
      },
    },
  );
  assert.ok(
    validatePilotExecutionReport(falseLoadPass).some((error) =>
      error.includes('dataset.shops to be at least 100'),
    ),
  );

  const falseAdminPass = baseExecutionReport(
    'admin-recovery',
    buildSteps(ADMIN_RECOVERY_STEPS, 'PASS'),
    {
      status: 'PASS',
      completedAt: '2026-07-25T11:00:00.000Z',
      aal: 'AAL1',
      auditEntriesVerified: false,
    },
  );
  const adminErrors = validatePilotExecutionReport(falseAdminPass);
  assert.ok(adminErrors.some((error) => error.includes('requires AAL2')));
  assert.ok(adminErrors.some((error) => error.includes('auditEntriesVerified=true')));
}

function runSecretScannerTests() {
  assert.equal(isClientSourcePath('apps/customer-app/src/config.ts'), true);
  assert.equal(isClientSourcePath('apps/backend/src/config.ts'), false);
  assert.equal(isClientSourcePath('apps/merchant-app/dist/config.js'), false);
  assert.equal(isClientSourcePath('apps/admin-dashboard/.next/server/config.js'), false);

  assert.deepEqual(
    scanClientSource(
      'apps/customer-app/src/config.ts',
      'export const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;',
    ),
    [],
  );

  assert.ok(
    scanClientSource(
      'apps/admin-dashboard/src/config.ts',
      'const serverSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;',
    ).some((violation) => violation.rule.includes('SUPABASE_SERVICE_ROLE_KEY')),
  );

  assert.ok(
    scanClientSource(
      'apps/captain-app/src/config.ts',
      'const key = "-----BEGIN PRIVATE KEY-----";',
    ).some((violation) => violation.rule === 'private key material'),
  );
}

try {
  runEvidenceTests();
  runExecutionReportTests();
  runSecretScannerTests();
  console.log('OK: Sprint 11 pilot tooling tests passed.');
} catch (error) {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : 'Unknown tooling test failure';
  console.error(message);
  process.exitCode = 1;
}
