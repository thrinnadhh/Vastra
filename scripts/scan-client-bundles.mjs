import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import {
  CLIENT_BUNDLE_DIRECTORIES,
  isClientBundlePath,
  scanClientBundle,
  validateClientBundleCoverage,
} from './client-bundle-scan-lib.mjs';

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
  const directoryFileCounts = {};
  let scannedFilesCount = 0;

  for (const directory of CLIENT_BUNDLE_DIRECTORIES) {
    const absoluteDirectory = resolve(repositoryRoot, directory);
    if (!existsSync(absoluteDirectory)) {
      continue;
    }

    directoryFileCounts[directory] = 0;

    for (const absolutePath of collectFiles(absoluteDirectory)) {
      const relativePath = relative(repositoryRoot, absolutePath).replaceAll('\\', '/');

      if (!isClientBundlePath(relativePath)) {
        continue;
      }

      scannedFilesCount += 1;
      directoryFileCounts[directory] += 1;
      const contents = readFileSync(absolutePath, 'utf8');
      violations.push(...scanClientBundle(relativePath, contents));
    }
  }

  const coverageErrors = validateClientBundleCoverage(directoryFileCounts);
  for (const error of coverageErrors) {
    console.error(`ERROR: ${error}`);
  }

  violations.sort((left, right) => {
    const pathComparison = left.path.localeCompare(right.path);
    return pathComparison === 0 ? left.line - right.line : pathComparison;
  });

  for (const violation of violations) {
    console.error(`ERROR: ${violation.path}:${violation.line} — ${violation.rule}`);
  }

  if (coverageErrors.length > 0 || violations.length > 0) {
    process.exitCode = 1;
  } else {
    console.log(
      `OK: scanned ${String(scannedFilesCount)} client build artifacts across every required output directory; no secret material found.`,
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown bundle secret scan failure';
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}
