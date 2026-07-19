import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validatePilotManifest } from './pilot-evidence-lib.mjs';

function readArguments(argumentsList) {
  let manifestPath = 'docs/pilot/evidence/manifest.json';
  let enforceGo = false;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === '--enforce-go') {
      enforceGo = true;
      continue;
    }

    if (argument === '--manifest') {
      const value = argumentsList[index + 1];
      if (value === undefined || value.trim().length === 0) {
        throw new Error('--manifest requires a repository-relative path.');
      }
      manifestPath = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return { manifestPath, enforceGo };
}

try {
  const repositoryRoot = process.cwd();
  const { manifestPath, enforceGo } = readArguments(process.argv.slice(2));
  const absoluteManifestPath = resolve(repositoryRoot, manifestPath);
  const manifest = JSON.parse(readFileSync(absoluteManifestPath, 'utf8'));
  const errors = validatePilotManifest(manifest, {
    repositoryRoot,
    enforceGo,
    evidenceExists: (evidencePath) => existsSync(resolve(repositoryRoot, evidencePath)),
  });

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`ERROR: ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      enforceGo
        ? 'OK: Sprint 11 evidence supports a signed GO decision.'
        : 'OK: Sprint 11 evidence manifest structure is valid.',
    );
  }
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Unknown pilot evidence validation failure';
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}
