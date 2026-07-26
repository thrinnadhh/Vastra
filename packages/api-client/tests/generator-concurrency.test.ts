import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatorPath = resolve(packageRoot, 'scripts/generate-openapi-types.mjs');

const runGenerator = () =>
  new Promise<Readonly<{ code: number | null; stderr: string }>>((resolveResult, reject) => {
    const child = spawn(process.execPath, [generatorPath], {
      cwd: packageRoot,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolveResult({ code, stderr });
    });
  });

describe('OpenAPI generator concurrency', () => {
  it(
    'allows independent workspace gates to generate the contract concurrently',
    async () => {
      const results = await Promise.all([
        runGenerator(),
        runGenerator(),
        runGenerator(),
        runGenerator(),
      ]);

      expect(results).toEqual([
        { code: 0, stderr: '' },
        { code: 0, stderr: '' },
        { code: 0, stderr: '' },
        { code: 0, stderr: '' },
      ]);
    },
    30_000,
  );
});
