// @ts-check

import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import nodePlugin from 'eslint-plugin-n';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const codeFiles = ['**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}'];

const typescriptFiles = ['**/*.{ts,cts,mts,tsx}'];

const reactFiles = ['**/*.{jsx,tsx}'];

const testFiles = [
  '**/*.{test,spec}.{js,cjs,mjs,jsx,ts,cts,mts,tsx}',
  '**/tests/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}',
];

const nodeFiles = [
  'eslint.config.mjs',
  '**/*.config.{js,cjs,mjs,ts,cts,mts}',
  'scripts/**/*.{js,cjs,mjs,ts,cts,mts}',
  'apps/backend/**/*.{js,cjs,mjs,ts,cts,mts}',
  'packages/config/**/*.{js,cjs,mjs,ts,cts,mts}',
  'packages/frontend-test-harness/**/*.{js,cjs,mjs,ts,cts,mts}',
  'e2e/**/*.{js,cjs,mjs,ts,cts,mts}',
  '.github/automation/**/*.{js,cjs,mjs}',
];

const mobileFiles = [
  'apps/customer-app/**/*.{js,jsx,ts,tsx}',
  'apps/merchant-app/**/*.{js,jsx,ts,tsx}',
  'apps/captain-app/**/*.{js,jsx,ts,tsx}',
];

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.pnpm-store/**',
    '**/.turbo/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/coverage/**',
    '**/.next/**',
    '**/.expo/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/*.tsbuildinfo',
    'supabase/.temp/**',
    'Vastra_Supabase_SQL_and_Env_Pack/**',
    'database/**',
    'wireframes/**',
  ]),

  {
    files: codeFiles,
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },

  {
    files: typescriptFiles,
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.ts', '*.config.mts', 'vitest.workspace.ts'],
          defaultProject: 'tsconfig.base.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },

  {
    files: ['.github/automation/fe-s05-02-evidence-App.tsx'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  {
    files: reactFiles,
    extends: [
      reactPlugin.configs.flat.recommended,
      reactPlugin.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
    ],
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  {
    files: testFiles,
    plugins: {
      vitest,
    },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
    rules: {
      ...vitest.configs.recommended.rules,
    },
  },

  {
    files: nodeFiles,
    plugins: {
      n: nodePlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    settings: {
      node: {
        version: '20.20.2',
      },
    },
    rules: {
      'n/no-deprecated-api': 'error',
      'n/no-process-exit': 'error',
      'n/prefer-node-protocol': 'error',
    },
  },

  {
    files: ['.github/automation/capture-fe-s05-02-evidence.cjs'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    files: mobileFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            'assert',
            'buffer',
            'child_process',
            'cluster',
            'crypto',
            'dns',
            'fs',
            'http',
            'https',
            'net',
            'os',
            'path',
            'process',
            'stream',
            'tls',
            'util',
            'worker_threads',
            'zlib',
          ],
          patterns: [
            {
              group: ['node:*'],
              message: 'Node-only modules must not be imported into Vastra mobile applications.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/backend/src/**/*.module.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
]);
