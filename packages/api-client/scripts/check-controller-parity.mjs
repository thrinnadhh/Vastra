import console from 'node:console';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');
const backendSourceRoot = resolve(repositoryRoot, 'apps/backend/src');
const generatedContractPath = resolve(packageRoot, 'src/generated/openapi.ts');

const HTTP_METHODS = new Map([
  ['Get', 'GET'],
  ['Put', 'PUT'],
  ['Post', 'POST'],
  ['Delete', 'DELETE'],
  ['Patch', 'PATCH'],
  ['Options', 'OPTIONS'],
  ['Head', 'HEAD'],
]);

function listControllerFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listControllerFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

function decoratorsOf(node) {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function findDecoratorCall(node, names) {
  for (const decorator of decoratorsOf(node)) {
    const expression = decorator.expression;
    if (
      ts.isCallExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      names.has(expression.expression.text)
    ) {
      return expression;
    }
  }
  return null;
}

function readStaticPath(call, label) {
  if (call.arguments.length === 0) {
    return '';
  }
  const [argument] = call.arguments;
  if (argument !== undefined && ts.isStringLiteralLike(argument)) {
    return argument.text;
  }
  throw new Error(`${label} must use a static string path`);
}

function normalizePath(controllerPath, methodPath) {
  const joined = [controllerPath, methodPath]
    .map((part) => part.replace(/^\/+|\/+$/gu, ''))
    .filter((part) => part.length > 0)
    .join('/');
  const path = `/${joined}`.replace(/\/+/gu, '/');
  return path.replace(/:([A-Za-z0-9_]+)/gu, '{$1}');
}

function collectControllerRoutes() {
  const routes = new Map();
  const methodNames = new Set(HTTP_METHODS.keys());

  for (const filePath of listControllerFiles(backendSourceRoot)) {
    const sourceText = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    for (const statement of sourceFile.statements) {
      if (!ts.isClassDeclaration(statement)) {
        continue;
      }
      const controller = findDecoratorCall(statement, new Set(['Controller']));
      if (controller === null) {
        continue;
      }
      const controllerPath = readStaticPath(
        controller,
        `${relative(repositoryRoot, filePath)} @Controller`,
      );

      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member)) {
          continue;
        }
        const methodDecorator = findDecoratorCall(member, methodNames);
        if (methodDecorator === null || !ts.isIdentifier(methodDecorator.expression)) {
          continue;
        }
        const method = HTTP_METHODS.get(methodDecorator.expression.text);
        if (method === undefined) {
          continue;
        }
        const methodPath = readStaticPath(
          methodDecorator,
          `${relative(repositoryRoot, filePath)} @${methodDecorator.expression.text}`,
        );
        const path = normalizePath(controllerPath, methodPath);
        const key = `${method} ${path}`;
        const locations = routes.get(key) ?? [];
        locations.push(relative(repositoryRoot, filePath));
        routes.set(key, locations);
      }
    }
  }

  return routes;
}

function collectOpenApiRoutes() {
  const generated = readFileSync(generatedContractPath, 'utf8');
  const marker = 'export const OPENAPI_OPERATIONS = ';
  const markerIndex = generated.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error('Generated OpenAPI operation registry is missing');
  }
  const operationsSection = generated.slice(markerIndex);
  const routePattern =
    /["']?method["']?\s*:\s*["'](GET|PUT|POST|DELETE|PATCH|OPTIONS|HEAD|TRACE)["'],\s+["']?path["']?\s*:\s*["']([^"']+)["']/gu;
  const routes = new Set();
  for (const match of operationsSection.matchAll(routePattern)) {
    const method = match[1];
    const path = match[2];
    if (method !== undefined && path !== undefined) {
      routes.add(`${method} ${path}`);
    }
  }
  return routes;
}

function main() {
  if (extname(generatedContractPath) !== '.ts') {
    throw new Error('Expected generated TypeScript contract');
  }

  const controllerRoutes = collectControllerRoutes();
  const openApiRoutes = collectOpenApiRoutes();
  const runtimeOnly = [...controllerRoutes.keys()]
    .filter((route) => !openApiRoutes.has(route))
    .sort();
  const contractOnly = [...openApiRoutes].filter((route) => !controllerRoutes.has(route)).sort();
  const duplicateRuntimeRoutes = [...controllerRoutes.entries()]
    .filter(([, locations]) => locations.length > 1)
    .map(([route, locations]) => `${route} (${locations.join(', ')})`)
    .sort();

  if (
    runtimeOnly.length === 0 &&
    contractOnly.length === 0 &&
    duplicateRuntimeRoutes.length === 0
  ) {
    console.log(`OK: ${String(openApiRoutes.size)} OpenAPI operations match backend controllers.`);
    return;
  }

  if (runtimeOnly.length > 0) {
    console.error(`Runtime-only routes (${String(runtimeOnly.length)}):`);
    for (const route of runtimeOnly) {
      console.error(`  ${route}`);
    }
  }
  if (contractOnly.length > 0) {
    console.error(`OpenAPI-only routes (${String(contractOnly.length)}):`);
    for (const route of contractOnly) {
      console.error(`  ${route}`);
    }
  }
  if (duplicateRuntimeRoutes.length > 0) {
    console.error(`Duplicate runtime routes (${String(duplicateRuntimeRoutes.length)}):`);
    for (const route of duplicateRuntimeRoutes) {
      console.error(`  ${route}`);
    }
  }
  process.exitCode = 1;
}

main();
