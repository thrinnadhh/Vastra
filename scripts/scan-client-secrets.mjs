import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { isClientSourcePath, scanClientSource } from './client-secret-scan-lib.mjs';

const CLIENT_DIRECTORIES = [
  'apps/customer-app',
  'apps/merchant-app',
  'apps/captain-app',
  'apps/admin-dashboard',
];

function collectFiles(directoryPath) {
  const files = [];

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = resolve(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

try {
  const repositoryRoot = process.cwd();
  const violations = [];

  for (const directory of CLIENT_DIRECTORIES) {
    const absoluteDirectory = resolve(repositoryRoot, directory);

    for (const absolutePath of collectFiles(absoluteDirectory)) {
      const relativePath = relative(repositoryRoot, absolutePath).replaceAll('\\', '/');

      if (!isClientSourcePath(relativePath)) {
        continue;
      }

      const contents = readFileSync(absolutePath, 'utf8');
      violations.push(...scanClientSource(relativePath, contents));
    }
  }

  violations.sort((left, right) => {
    const pathComparison = left.path.localeCompare(right.path);
    return pathComparison === 0 ? left.line - right.line : pathComparison;
  });

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`ERROR: ${violation.path}:${violation.line} — ${violation.rule}`);
    }
    process.exitCode = 1;
  } else {
    console.log('OK: no privileged identifiers or hard-coded secret material found in client apps.');
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown client secret scan failure';
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}
