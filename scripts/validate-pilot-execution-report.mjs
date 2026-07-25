import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { validatePilotExecutionReport } from './pilot-execution-report-lib.mjs';

function readArguments(argumentsList) {
  let reportPath = null;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument !== '--report') throw new Error(`Unknown argument: ${argument}`);
    const value = argumentsList[index + 1];
    if (value === undefined || value.trim().length === 0) {
      throw new Error('--report requires a repository-relative JSON path.');
    }
    reportPath = value;
    index += 1;
  }

  if (reportPath === null) throw new Error('--report is required.');
  return reportPath;
}

try {
  const repositoryRoot = process.cwd();
  const reportPath = readArguments(process.argv.slice(2));
  const report = JSON.parse(readFileSync(resolve(repositoryRoot, reportPath), 'utf8'));
  const errors = validatePilotExecutionReport(report, {
    repositoryRoot,
    evidenceExists: (evidencePath) => existsSync(resolve(repositoryRoot, evidencePath)),
  });

  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: pilot execution report is valid: ${reportPath}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown execution-report failure';
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}
