import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const CHECKS = [
  {
    id: 'inventory-balance-valid',
    sql: `
      select count(*)
      from public.inventory_balances
      where stock_on_hand < reserved_quantity + damaged_quantity
    `,
  },
  {
    id: 'active-reservations-covered',
    sql: `
      select count(*)
      from (
        select
          r.shop_id,
          r.variant_id,
          sum(r.quantity) as active_quantity,
          max(b.reserved_quantity) as reserved_quantity
        from public.inventory_reservations r
        join public.inventory_balances b
          on b.shop_id = r.shop_id
         and b.variant_id = r.variant_id
        where r.status = 'ACTIVE'
        group by r.shop_id, r.variant_id
        having sum(r.quantity) > max(b.reserved_quantity)
      ) violations
    `,
  },
  {
    id: 'one-accepted-assignment-per-task',
    sql: `
      select count(*)
      from (
        select delivery_task_id
        from public.delivery_assignments
        where assignment_status = 'ACCEPTED'
        group by delivery_task_id
        having count(*) > 1
      ) violations
    `,
  },
  {
    id: 'one-active-task-per-captain',
    sql: `
      select count(*)
      from (
        select assigned_captain_id
        from public.delivery_tasks
        where assigned_captain_id is not null
          and status in ('ASSIGNED', 'AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'AT_DROP')
        group by assigned_captain_id
        having count(*) > 1
      ) violations
    `,
  },
  {
    id: 'delivery-order-state-aligned',
    sql: `
      select count(*)
      from public.delivery_tasks task
      join public.orders orders
        on orders.id = task.order_id
      where (orders.status = 'CAPTAIN_ASSIGNED' and task.status <> 'ASSIGNED')
         or (orders.status = 'CAPTAIN_AT_STORE' and task.status <> 'AT_PICKUP')
         or (orders.status = 'PICKED_UP' and task.status <> 'PICKED_UP')
         or (orders.status = 'OUT_FOR_DELIVERY' and task.status <> 'IN_TRANSIT')
         or (orders.status = 'CAPTAIN_AT_CUSTOMER' and task.status <> 'AT_DROP')
         or (orders.status = 'DELIVERED' and task.status <> 'COMPLETED')
    `,
  },
  {
    id: 'delivered-orders-have-history',
    sql: `
      select count(*)
      from public.orders orders
      where orders.status = 'DELIVERED'
        and not exists (
          select 1
          from public.order_status_history history
          where history.order_id = orders.id
            and history.status = 'DELIVERED'
        )
    `,
  },
  {
    id: 'completed-tasks-have-delivery-event',
    sql: `
      select count(*)
      from public.delivery_tasks task
      where task.status = 'COMPLETED'
        and not exists (
          select 1
          from public.delivery_events event
          where event.delivery_task_id = task.id
            and event.event_type = 'TASK_COMPLETED'
        )
    `,
  },
  {
    id: 'cod-completion-has-collection',
    sql: `
      select count(*)
      from public.orders orders
      where orders.payment_status = 'COD_COLLECTED'
        and not exists (
          select 1
          from public.cod_collections collection
          where collection.order_id = orders.id
            and collection.status in ('COLLECTED', 'DEPOSIT_PENDING', 'DEPOSITED', 'RECONCILED')
        )
    `,
  },
  {
    id: 'delivery-completion-outbox-not-duplicated',
    sql: `
      select count(*)
      from (
        select aggregate_type, aggregate_id, event_type
        from public.outbox_events
        where event_type = 'delivery.task.completed'
        group by aggregate_type, aggregate_id, event_type
        having count(*) > 1
      ) violations
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
      env: { ...process.env, PGAPPNAME: 'vastra-pilot-invariant-audit' },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `psql exited with status ${result.status}`);
  }
  return result.stdout.trim();
}

function writeJson(outputPath, report) {
  const absolutePath = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

try {
  if (requiredEnvironment('PILOT_ENVIRONMENT') !== 'staging') {
    throw new Error('PILOT_ENVIRONMENT must equal staging.');
  }
  const connectionString = requiredEnvironment('PILOT_DATABASE_URL');
  const releaseCommit = requiredEnvironment('PILOT_RELEASE_COMMIT');
  const operator = requiredEnvironment('PILOT_OPERATOR');
  const outputPath = requiredEnvironment('PILOT_INVARIANT_REPORT_PATH');

  const checks = CHECKS.map((check) => {
    const count = Number(psql(connectionString, check.sql));
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Invalid invariant count for ${check.id}.`);
    }
    return { id: check.id, violations: count, status: count === 0 ? 'PASS' : 'FAIL' };
  });
  const violationCount = checks.reduce((total, check) => total + check.violations, 0);
  const report = {
    schemaVersion: 1,
    type: 'invariant-audit',
    releaseCommit,
    environment: 'staging',
    status: violationCount === 0 ? 'PASS' : 'FAIL',
    generatedAt: new Date().toISOString(),
    operator,
    violationCount,
    checks,
    notes:
      violationCount === 0
        ? 'No critical invariant violations were detected after load execution.'
        : 'Critical invariant violations were detected. Pilot decision must remain NO_GO.',
  };
  writeJson(outputPath, report);

  if (violationCount > 0) {
    console.error(`FAIL: ${violationCount} invariant violations detected. Report: ${outputPath}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: no invariant violations detected. Report: ${outputPath}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown invariant audit failure';
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}
