import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { LOAD_QUERY_SCENARIOS } from './pilot-execution-report-lib.mjs';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value.trim();
}

function percentile(values, percentage) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentage) - 1);
  return sorted[index];
}

function safeBaseUrl(value) {
  const url = new URL(value);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (!local && url.protocol !== 'https:') throw new Error('PILOT_API_BASE_URL must use HTTPS.');
  if (url.hostname === 'api.vastra.in') throw new Error('Load runner refuses the production API.');
  return value.replace(/\/+$/u, '');
}

function substitute(value, requestUuid) {
  if (typeof value === 'string') {
    return value
      .replaceAll('${UUID}', requestUuid)
      .replaceAll(/\$\{ENV:([A-Z0-9_]+)\}/gu, (_match, name) => {
        const environmentValue = process.env[name];
        if (environmentValue === undefined) throw new Error(`Missing environment value: ${name}`);
        return environmentValue;
      });
  }
  if (Array.isArray(value)) return value.map((entry) => substitute(entry, requestUuid));
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, substitute(entry, requestUuid)]),
    );
  }
  return value;
}

function requestIdFromBody(body) {
  if (!isRecord(body)) return null;
  if (isRecord(body.meta) && typeof body.meta.requestId === 'string') return body.meta.requestId;
  return typeof body.requestId === 'string' ? body.requestId : null;
}

function validatePlan(plan) {
  if (!isRecord(plan) || plan.schemaVersion !== 1) throw new Error('Invalid load plan.');
  if (!Array.isArray(plan.scenarios)) throw new Error('Load plan scenarios must be an array.');
  const seen = new Set();
  for (const [index, scenario] of plan.scenarios.entries()) {
    if (!isRecord(scenario)) throw new Error(`scenarios[${index}] must be an object.`);
    const id = requiredString(scenario.id, `scenarios[${index}].id`);
    if (seen.has(id)) throw new Error(`Duplicate load scenario: ${id}`);
    seen.add(id);
    if (!['read', 'command'].includes(scenario.kind)) {
      throw new Error(`scenarios[${index}].kind must be read or command.`);
    }
    if (!Number.isSafeInteger(scenario.requests) || scenario.requests <= 0) {
      throw new Error(`scenarios[${index}].requests must be positive.`);
    }
    if (!Number.isSafeInteger(scenario.concurrency) || scenario.concurrency <= 0) {
      throw new Error(`scenarios[${index}].concurrency must be positive.`);
    }
    if (!Array.isArray(scenario.expectedStatuses) || scenario.expectedStatuses.length === 0) {
      throw new Error(`scenarios[${index}].expectedStatuses is required.`);
    }
    if (
      scenario.idempotency !== undefined &&
      !['unique', 'fixed', 'none'].includes(scenario.idempotency)
    ) {
      throw new Error(`scenarios[${index}].idempotency is invalid.`);
    }
  }
  for (const id of LOAD_QUERY_SCENARIOS) {
    if (!seen.has(id)) throw new Error(`Required load scenario is missing: ${id}`);
  }
  if (seen.size !== LOAD_QUERY_SCENARIOS.length || plan.scenarios.length !== LOAD_QUERY_SCENARIOS.length) {
    throw new Error('Load plan must contain exactly the frozen pilot scenarios.');
  }
}

async function runOneRequest(baseUrl, scenario, fixedIdempotencyKey) {
  const requestUuid = randomUUID();
  const token = process.env[requiredString(scenario.tokenEnv, `${scenario.id}.tokenEnv`)];
  if (token === undefined || token.trim().length === 0) {
    throw new Error(`Missing actor token environment value: ${scenario.tokenEnv}`);
  }
  const method = requiredString(scenario.method, `${scenario.id}.method`).toUpperCase();
  const path = substitute(requiredString(scenario.path, `${scenario.id}.path`), requestUuid);
  const body = scenario.body === null || scenario.body === undefined ? undefined : substitute(scenario.body, requestUuid);
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Request-Id': requestUuid,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (scenario.idempotency === 'unique') headers['Idempotency-Key'] = requestUuid;
  if (scenario.idempotency === 'fixed') headers['Idempotency-Key'] = fixedIdempotencyKey;

  const started = performance.now();
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(scenario.timeoutMs ?? 15_000),
    });
  } catch (error) {
    return {
      success: false,
      latencyMs: performance.now() - started,
      status: 0,
      requestId: requestUuid,
      error: error instanceof Error ? error.message : 'Transport failure',
    };
  }

  let responseBody = null;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }
  return {
    success: scenario.expectedStatuses.includes(response.status),
    latencyMs: performance.now() - started,
    status: response.status,
    requestId: response.headers.get('x-request-id') ?? requestIdFromBody(responseBody) ?? requestUuid,
    error: scenario.expectedStatuses.includes(response.status) ? null : `Unexpected HTTP ${response.status}`,
  };
}

async function runScenario(baseUrl, scenario) {
  const fixedIdempotencyKey = randomUUID();
  const results = [];
  let nextRequest = 0;

  async function worker() {
    while (true) {
      const requestIndex = nextRequest;
      nextRequest += 1;
      if (requestIndex >= scenario.requests) return;
      results.push(await runOneRequest(baseUrl, scenario, fixedIdempotencyKey));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(scenario.concurrency, scenario.requests) }, () => worker()),
  );
  const latencies = results.map((result) => result.latencyMs);
  const successes = results.filter((result) => result.success).length;
  const successRate = successes / results.length;
  const p95Ms = percentile(latencies, 0.95);
  const minimumSuccessRate = scenario.kind === 'read' ? 0.999 : 0.995;
  const maximumP95Ms = scenario.kind === 'read' ? 750 : 1500;
  const passed = successRate >= minimumSuccessRate && p95Ms <= maximumP95Ms;

  return {
    id: scenario.id,
    kind: scenario.kind,
    status: passed ? 'PASS' : 'FAIL',
    observedAt: new Date().toISOString(),
    requestIds: results.map((result) => result.requestId).filter(Boolean).slice(0, 20),
    evidence: [],
    notes: `${successes}/${results.length} requests succeeded; p95=${p95Ms.toFixed(2)} ms.`,
    requests: results.length,
    successes,
    successRate,
    p50Ms: percentile(latencies, 0.5),
    p95Ms,
    p99Ms: percentile(latencies, 0.99),
    maximumMs: Math.max(...latencies),
    errors: Object.entries(
      results.reduce((counts, result) => {
        if (result.success) return counts;
        const key = `${result.status}:${result.error ?? 'unknown'}`;
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    ).map(([error, count]) => ({ error, count })),
  };
}

function aggregate(steps, kind) {
  const selected = steps.filter((step) => step.kind === kind);
  const requestCount = selected.reduce((total, step) => total + step.requests, 0);
  const successCount = selected.reduce((total, step) => total + step.successes, 0);
  return {
    successRate: requestCount === 0 ? 0 : successCount / requestCount,
    p95Ms: Math.max(...selected.map((step) => step.p95Ms), 0),
  };
}

function runPostLoadInvariantAudit(invariantPath) {
  const audit = spawnSync(process.execPath, ['scripts/run-pilot-invariant-audit.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      PILOT_INVARIANT_REPORT_PATH: invariantPath,
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  if (audit.error !== undefined) throw audit.error;
  const absolutePath = resolve(process.cwd(), invariantPath);
  if (!existsSync(absolutePath)) {
    throw new Error(audit.stderr.trim() || 'Post-load invariant audit did not create a report.');
  }
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

function writeReport(outputPath, report) {
  const absolutePath = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

try {
  const argumentsList = process.argv.slice(2);
  const planIndex = argumentsList.indexOf('--plan');
  const outputIndex = argumentsList.indexOf('--output');
  const queryIndex = argumentsList.indexOf('--query-plans');
  const invariantIndex = argumentsList.indexOf('--invariants');
  if ([planIndex, outputIndex, queryIndex, invariantIndex].some((index) => index < 0)) {
    throw new Error('--plan, --output, --query-plans, and --invariants are required.');
  }
  const planPath = argumentsList[planIndex + 1];
  const outputPath = argumentsList[outputIndex + 1];
  const queryPlanPath = argumentsList[queryIndex + 1];
  const invariantPath = argumentsList[invariantIndex + 1];
  if ([planPath, outputPath, queryPlanPath, invariantPath].some((value) => value === undefined)) {
    throw new Error('Every pilot load argument requires a path.');
  }
  if (process.env.PILOT_ALLOW_STAGING_MUTATIONS !== 'YES') {
    throw new Error('PILOT_ALLOW_STAGING_MUTATIONS=YES is required.');
  }

  const plan = JSON.parse(readFileSync(resolve(process.cwd(), planPath), 'utf8'));
  validatePlan(plan);
  if (plan.environment !== 'staging') throw new Error('Load plan environment must equal staging.');
  const baseUrl = safeBaseUrl(requiredString(process.env.PILOT_API_BASE_URL, 'PILOT_API_BASE_URL'));
  const queryPlan = JSON.parse(readFileSync(resolve(process.cwd(), queryPlanPath), 'utf8'));
  if (queryPlan.status !== 'PASS') throw new Error('Query-plan evidence must pass before load execution.');

  const startedAt = new Date().toISOString();
  const detailedSteps = [];
  for (const scenario of plan.scenarios) detailedSteps.push(await runScenario(baseUrl, scenario));

  const invariantReport = runPostLoadInvariantAudit(invariantPath);
  if (invariantReport.environment !== 'staging') throw new Error('Invariant report must target staging.');
  const readMetrics = aggregate(detailedSteps, 'read');
  const commandMetrics = aggregate(detailedSteps, 'command');
  const invariantViolations = Number(invariantReport.violationCount);
  const passed = detailedSteps.every((step) => step.status === 'PASS') && invariantViolations === 0;
  const evidence = [queryPlanPath, invariantPath].filter((path) => existsSync(resolve(process.cwd(), path)));
  const report = {
    schemaVersion: 1,
    type: 'load-query',
    releaseCommit: requiredString(plan.releaseCommit, 'plan.releaseCommit'),
    environment: 'staging',
    status: passed ? 'PASS' : 'FAIL',
    startedAt,
    completedAt: new Date().toISOString(),
    operator: requiredString(plan.operator, 'plan.operator'),
    notes: passed
      ? 'All staging load thresholds and post-load invariants passed.'
      : 'One or more staging load thresholds or post-load invariants failed.',
    dataset: queryPlan.dataset,
    metrics: {
      criticalReadSuccessRate: readMetrics.successRate,
      criticalCommandSuccessRate: commandMetrics.successRate,
      p95CriticalReadMs: readMetrics.p95Ms,
      p95CriticalCommandMs: commandMetrics.p95Ms,
      invariantViolations,
    },
    steps: detailedSteps.map((step) => ({
      id: step.id,
      status: step.status,
      observedAt: step.observedAt,
      requestIds: step.requestIds,
      evidence,
      notes: step.notes,
    })),
    scenarioMetrics: detailedSteps,
  };
  writeReport(outputPath, report);
  if (!passed) {
    console.error(`FAIL: staging load or invariants failed. Report: ${outputPath}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: staging load and invariant gates passed. Report: ${outputPath}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown staging load failure';
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}
