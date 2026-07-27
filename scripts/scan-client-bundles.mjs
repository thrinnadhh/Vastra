import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { isClientBundlePath, scanClientBundle } from './client-bundle-scan-lib.mjs';

const BUNDLE_DIRECTORIES = [
  'apps/admin-dashboard/.next/static',
  'apps/admin-dashboard/.next/server',
  'apps/customer-app/dist',
  'apps/merchant-app/dist',
  'apps/captain-app/dist',
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
  let scannedFilesCount = 0;

  for (const directory of BUNDLE_DIRECTORIES) {
    const absoluteDirectory = resolve(repositoryRoot, directory);
    if (!existsSync(absoluteDirectory)) {
      continue;
    }

    for (const absolutePath of collectFiles(absoluteDirectory)) {
      const relativePath = relative(repositoryRoot, absolutePath).replaceAll('\\', '/');

      if (!isClientBundlePath(relativePath)) {
        continue;
      }

      scannedFilesCount += 1;
      const contents = readFileSync(absolutePath, 'utf8');
      violations.push(...scanClientBundle(relativePath, contents));
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
    console.log(
      `OK: scanned ${String(scannedFilesCount)} client build artifacts; no secret material found.`,
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown bundle secret scan failure';
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}
