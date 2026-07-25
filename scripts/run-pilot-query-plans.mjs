import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const MINIMUM_DATASET = {
  shops: 100,
  products: 1000,
  variants: 3000,
  orders: 1000,
  captains: 100,
};

const QUERIES = [
  {
    id: 'nearby-shop-discovery',
    sql: `
      select id
      from public.shops
      where verification_status = 'VERIFIED'
        and operational_status = 'OPEN'
        and deleted_at is null
      order by id
      limit 100
    `,
  },
  {
    id: 'product-search',
    sql: `
      select id
      from public.products
      where is_active
        and moderation_status = 'APPROVED'
        and deleted_at is null
        and search_vector @@ plainto_tsquery('simple', 'shirt')
      limit 100
    `,
  },
  {
    id: 'customer-order-read',
    sql: `
      select id, status, created_at
      from public.orders
      where customer_id = (
        select customer_id
        from public.orders
        order by created_at desc
        limit 1
      )
      order by created_at desc
      limit 20
    `,
  },
  {
    id: 'merchant-order-queue',
    sql: `
      select id, status, created_at
      from public.orders
      where shop_id = (
        select shop_id
        from public.orders
        order by created_at desc
        limit 1
      )
        and status in (
          'WAITING_FOR_MERCHANT',
          'MERCHANT_ACCEPTED',
          'PACKING',
          'READY_FOR_PICKUP'
        )
      order by created_at desc
      limit 50
    `,
  },
  {
    id: 'captain-offer-read',
    sql: `
      select id, delivery_task_id, assignment_status, offered_at
      from public.delivery_assignments
      where captain_id = (
        select captain_id
        from public.delivery_assignments
        where captain_id is not null
        order by offered_at desc
        limit 1
      )
        and assignment_status = 'OFFERED'
      order by offered_at desc
      limit 20
    `,
  },
  {
    id: 'inventory-reservation-expiry',
    sql: `
      select id, expires_at
      from public.inventory_reservations
      where status = 'ACTIVE'
        and expires_at <= now()
      order by expires_at
      limit 100
    `,
  },
  {
    id: 'outbox-worker-claim-read',
    sql: `
      select id, status, available_at, attempt_count
      from public.outbox_events
      where status in ('PENDING', 'FAILED')
        and available_at <= now()
      order by available_at, attempt_count
      limit 100
    `,
  },
];

function requiredEnvironment(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required.`);
  return value.trim();
}

function psql(connectionString, sql) {
  const result = spawnSync(
    'psql',
    [
      connectionString,
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
      '--command',
      sql,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, PGAPPNAME: 'vastra-pilot-query-plan-audit' },
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `psql exited with status ${result.status}`);
  }
  return result.stdout.trim();
}

function explain(connectionString, sql) {
  const output = psql(
    connectionString,
    `set statement_timeout = '30s'; explain (analyze, buffers, format json) ${sql}`,
  );
  const parsed = JSON.parse(output);
  const summary = parsed[0];
  return {
    planningTimeMs: summary['Planning Time'],
    executionTimeMs: summary['Execution Time'],
    plan: summary.Plan,
  };
}

function writeJson(outputPath, value) {
  const absolutePath = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

try {
  if (requiredEnvironment('PILOT_ENVIRONMENT') !== 'staging') {
    throw new Error('PILOT_ENVIRONMENT must equal staging.');
  }
  const connectionString = requiredEnvironment('PILOT_DATABASE_URL');
  const releaseCommit = requiredEnvironment('PILOT_RELEASE_COMMIT');
  const operator = requiredEnvironment('PILOT_OPERATOR');
  const outputPath = requiredEnvironment('PILOT_QUERY_PLAN_REPORT_PATH');

  const dataset = JSON.parse(
    psql(
      connectionString,
      `
        select json_build_object(
          'shops', (select count(*) from public.shops),
          'products', (select count(*) from public.products),
          'variants', (select count(*) from public.product_variants),
          'orders', (select count(*) from public.orders),
          'captains', (select count(*) from public.captain_profiles)
        )
      `,
    ),
  );

  const insufficient = Object.entries(MINIMUM_DATASET).filter(
    ([key, minimum]) => Number(dataset[key]) < minimum,
  );
  if (insufficient.length > 0) {
    const report = {
      schemaVersion: 1,
      type: 'query-plan-evidence',
      releaseCommit,
      environment: 'staging',
      status: 'BLOCKED',
      generatedAt: new Date().toISOString(),
      operator,
      dataset,
      queries: [],
      notes: `Dataset is below pilot minimums: ${insufficient
        .map(([key, minimum]) => `${key}<${minimum}`)
        .join(', ')}.`,
    };
    writeJson(outputPath, report);
    console.error(`BLOCKED: staging dataset is not realistic enough. Report: ${outputPath}`);
    process.exitCode = 1;
  } else {
    const queryPlans = QUERIES.map((query) => ({
      id: query.id,
      ...explain(connectionString, query.sql),
    }));
    const report = {
      schemaVersion: 1,
      type: 'query-plan-evidence',
      releaseCommit,
      environment: 'staging',
      status: 'PASS',
      generatedAt: new Date().toISOString(),
      operator,
      dataset,
      queries: queryPlans,
      notes: 'Read-only EXPLAIN ANALYZE plans captured against a staging-sized dataset.',
    };
    writeJson(outputPath, report);
    console.log(`OK: staging query plans captured. Report: ${outputPath}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown query-plan audit failure';
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}
