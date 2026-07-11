import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseCommonEnv } from '../packages/config/src/env/common.js';
import { parseMobileEnv } from '../packages/config/src/env/mobile.js';
import { parseServerEnv } from '../packages/config/src/env/server.js';
import { parseWebEnv } from '../packages/config/src/env/web.js';

type EnvironmentParser = (input: Readonly<Record<string, string>>) => unknown;

interface EnvironmentCheck {
  readonly label: string;
  readonly file: string;
  readonly parse: EnvironmentParser;
}

function parseEnvironmentFile(filePath: string): Record<string, string> {
  const environment: Record<string, string> = {};
  const contents: string = readFileSync(filePath, 'utf8');

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex <= 0) {
      throw new Error(`Invalid environment example line in ${filePath}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    let hasMatchingQuotes = false;

    if (value.startsWith('"')) {
      hasMatchingQuotes = value.endsWith('"');
    } else if (value.startsWith("'")) {
      hasMatchingQuotes = value.endsWith("'");
    }

    if (hasMatchingQuotes) {
      value = value.slice(1, -1);
    }

    environment[key] = value;
  }

  return environment;
}

const repositoryRoot: string = process.cwd();

const checks: readonly EnvironmentCheck[] = [
  {
    label: 'root',
    file: '.env.example',
    parse: parseCommonEnv,
  },
  {
    label: 'customer app',
    file: 'apps/customer-app/.env.example',
    parse: parseMobileEnv,
  },
  {
    label: 'merchant app',
    file: 'apps/merchant-app/.env.example',
    parse: parseMobileEnv,
  },
  {
    label: 'captain app',
    file: 'apps/captain-app/.env.example',
    parse: parseMobileEnv,
  },
  {
    label: 'admin dashboard',
    file: 'apps/admin-dashboard/.env.example',
    parse: parseWebEnv,
  },
  {
    label: 'backend',
    file: 'apps/backend/.env.example',
    parse: parseServerEnv,
  },
];

try {
  for (const check of checks) {
    const filePath = resolve(repositoryRoot, check.file);
    const environment = parseEnvironmentFile(filePath);

    check.parse(environment);

    console.log(`OK: ${check.label} environment`);
  }
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown environment validation failure';

  console.error(message);
  process.exitCode = 1;
}
