import assert from 'node:assert/strict';

import { isClientSourcePath, scanClientSource } from './client-secret-scan-lib.mjs';
import { validatePilotManifest } from './pilot-evidence-lib.mjs';

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

function runSecretScannerTests() {
  assert.equal(isClientSourcePath('apps/customer-app/src/config.ts'), true);
  assert.equal(isClientSourcePath('apps/backend/src/config.ts'), false);
  assert.equal(isClientSourcePath('apps/merchant-app/dist/config.js'), false);

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
  runSecretScannerTests();
  console.log('OK: Sprint 11 pilot tooling tests passed.');
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : 'Unknown tooling test failure';
  console.error(message);
  process.exitCode = 1;
}
