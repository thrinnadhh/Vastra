import assert from 'node:assert/strict';

import {
  CLIENT_BUNDLE_DIRECTORIES,
  validateClientBundleCoverage,
} from './client-bundle-scan-lib.mjs';

try {
  const completeCoverage = Object.fromEntries(
    CLIENT_BUNDLE_DIRECTORIES.map((directory) => [directory, 1]),
  );
  assert.deepEqual(validateClientBundleCoverage(completeCoverage), []);

  const missingDirectoryCoverage = { ...completeCoverage };
  delete missingDirectoryCoverage[CLIENT_BUNDLE_DIRECTORIES[0]];
  assert.ok(
    validateClientBundleCoverage(missingDirectoryCoverage).some((error) =>
      error.includes('required client bundle directory is missing'),
    ),
  );

  const emptyDirectoryCoverage = { ...completeCoverage };
  emptyDirectoryCoverage[CLIENT_BUNDLE_DIRECTORIES[1]] = 0;
  assert.ok(
    validateClientBundleCoverage(emptyDirectoryCoverage).some((error) =>
      error.includes('has no scannable artifacts'),
    ),
  );

  assert.ok(
    validateClientBundleCoverage({}).length === CLIENT_BUNDLE_DIRECTORIES.length,
    'every required output must fail when no bundles were produced',
  );

  console.log('OK: client bundle scan coverage tests passed.');
} catch (error) {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : 'Unknown bundle scan test failure';
  console.error(message);
  process.exitCode = 1;
}
