import { isAbsolute, relative, resolve } from 'node:path';

const REQUIRED_CHECK_IDS = [
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

const CHECK_STATUSES = new Set(['NOT_RUN', 'PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE']);
const DECISIONS = new Set(['NOT_ASSESSED', 'GO', 'NO_GO']);
const SEVERITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
const DEFECT_STATUSES = new Set(['OPEN', 'FIXED', 'CLOSED']);

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateEvidencePath(repositoryRoot, evidencePath) {
  if (!isNonEmptyString(evidencePath) || isAbsolute(evidencePath)) {
    return false;
  }

  const resolvedPath = resolve(repositoryRoot, evidencePath);
  const relativePath = relative(repositoryRoot, resolvedPath);

  return (
    relativePath.length > 0 &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
  );
}

export function validatePilotManifest(
  manifest,
  { repositoryRoot = process.cwd(), evidenceExists = () => true, enforceGo = false } = {},
) {
  const errors = [];

  if (!isRecord(manifest)) {
    return ['Pilot evidence manifest must be a JSON object.'];
  }

  if (manifest.schemaVersion !== 1) {
    errors.push('schemaVersion must equal 1.');
  }

  if (manifest.pilot !== 'tirupati-limited') {
    errors.push('pilot must equal tirupati-limited.');
  }

  if (manifest.releaseCommit !== null && !/^[0-9a-f]{40}$/u.test(manifest.releaseCommit)) {
    errors.push('releaseCommit must be null or a full lowercase 40-character Git SHA.');
  }

  if (!DECISIONS.has(manifest.decision)) {
    errors.push('decision must be NOT_ASSESSED, GO, or NO_GO.');
  }

  if (!isNonEmptyString(manifest.decisionNotes)) {
    errors.push('decisionNotes must explain the current release decision.');
  }

  if (!isRecord(manifest.signOff)) {
    errors.push('signOff must be an object.');
  } else {
    for (const role of ['productOwner', 'engineeringOwner', 'operationsOwner']) {
      const signer = manifest.signOff[role];
      if (signer !== null && !isNonEmptyString(signer)) {
        errors.push(`signOff.${role} must be null or a non-empty string.`);
      }
    }
  }

  if (!Array.isArray(manifest.checks)) {
    errors.push('checks must be an array.');
  }

  const checks = Array.isArray(manifest.checks) ? manifest.checks : [];
  const seenCheckIds = new Set();

  for (const [index, check] of checks.entries()) {
    const prefix = `checks[${index}]`;

    if (!isRecord(check)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }

    if (!isNonEmptyString(check.id)) {
      errors.push(`${prefix}.id must be a non-empty string.`);
    } else if (seenCheckIds.has(check.id)) {
      errors.push(`${prefix}.id duplicates ${check.id}.`);
    } else {
      seenCheckIds.add(check.id);
    }

    if (!isNonEmptyString(check.category)) {
      errors.push(`${prefix}.category must be a non-empty string.`);
    }

    if (!SEVERITIES.has(check.severity)) {
      errors.push(`${prefix}.severity is invalid.`);
    }

    if (!CHECK_STATUSES.has(check.status)) {
      errors.push(`${prefix}.status is invalid.`);
    }

    if (!isNonEmptyString(check.owner)) {
      errors.push(`${prefix}.owner must be a non-empty string.`);
    }

    if (!Array.isArray(check.evidence)) {
      errors.push(`${prefix}.evidence must be an array.`);
    } else {
      for (const evidencePath of check.evidence) {
        if (!validateEvidencePath(repositoryRoot, evidencePath)) {
          errors.push(`${prefix}.evidence contains an unsafe repository path.`);
          continue;
        }

        if (check.status === 'PASS' && !evidenceExists(evidencePath)) {
          errors.push(`${prefix}.evidence does not exist: ${evidencePath}`);
        }
      }
    }

    if (
      check.status === 'PASS' &&
      (!Array.isArray(check.evidence) || check.evidence.length === 0)
    ) {
      errors.push(`${prefix} cannot be PASS without evidence.`);
    }

    if (
      (check.status === 'FAIL' ||
        check.status === 'BLOCKED' ||
        check.status === 'NOT_APPLICABLE') &&
      !isNonEmptyString(check.notes)
    ) {
      errors.push(`${prefix}.notes must explain ${check.status}.`);
    }
  }

  for (const requiredId of REQUIRED_CHECK_IDS) {
    if (!seenCheckIds.has(requiredId)) {
      errors.push(`Required check is missing: ${requiredId}.`);
    }
  }

  if (
    seenCheckIds.size !== REQUIRED_CHECK_IDS.length ||
    checks.length !== REQUIRED_CHECK_IDS.length
  ) {
    errors.push('checks must contain exactly the frozen Sprint 11 release gates.');
  }

  if (!Array.isArray(manifest.openDefects)) {
    errors.push('openDefects must be an array.');
  }

  const defects = Array.isArray(manifest.openDefects) ? manifest.openDefects : [];
  const seenDefectIds = new Set();

  for (const [index, defect] of defects.entries()) {
    const prefix = `openDefects[${index}]`;

    if (!isRecord(defect)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }

    if (!isNonEmptyString(defect.id)) {
      errors.push(`${prefix}.id must be a non-empty string.`);
    } else if (seenDefectIds.has(defect.id)) {
      errors.push(`${prefix}.id duplicates ${defect.id}.`);
    } else {
      seenDefectIds.add(defect.id);
    }

    if (!SEVERITIES.has(defect.severity)) {
      errors.push(`${prefix}.severity is invalid.`);
    }

    if (!DEFECT_STATUSES.has(defect.status)) {
      errors.push(`${prefix}.status must be OPEN, FIXED, or CLOSED.`);
    }

    if (!isNonEmptyString(defect.owner) || !isNonEmptyString(defect.summary)) {
      errors.push(`${prefix} requires owner and summary.`);
    }
  }

  const blockingChecks = checks.filter(
    (check) =>
      isRecord(check) &&
      (check.severity === 'CRITICAL' || check.severity === 'HIGH') &&
      check.status !== 'PASS' &&
      check.status !== 'NOT_APPLICABLE',
  );
  const blockingDefects = defects.filter(
    (defect) =>
      isRecord(defect) &&
      (defect.severity === 'CRITICAL' || defect.severity === 'HIGH') &&
      defect.status === 'OPEN',
  );
  const signers = isRecord(manifest.signOff)
    ? [
        manifest.signOff.productOwner,
        manifest.signOff.engineeringOwner,
        manifest.signOff.operationsOwner,
      ]
    : [];

  if (manifest.decision === 'GO') {
    if (manifest.releaseCommit === null) {
      errors.push('GO requires releaseCommit.');
    }
    if (blockingChecks.length > 0) {
      errors.push('GO is forbidden while critical/high checks are incomplete or failing.');
    }
    if (blockingDefects.length > 0) {
      errors.push('GO is forbidden while critical/high defects remain open.');
    }
    if (signers.length !== 3 || signers.some((signer) => !isNonEmptyString(signer))) {
      errors.push('GO requires product, engineering, and operations sign-off.');
    }
  }

  if (enforceGo && manifest.decision !== 'GO') {
    errors.push('Final pilot gate requires decision GO.');
  }

  return errors;
}
