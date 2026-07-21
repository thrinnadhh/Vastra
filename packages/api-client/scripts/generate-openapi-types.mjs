import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');
const openApiPath = resolve(repositoryRoot, 'docs/api/openapi.yaml');
const generatedDirectory = resolve(packageRoot, 'src/generated');
const bundledPath = resolve(generatedDirectory, '.openapi.bundle.json');
const outputPath = resolve(generatedDirectory, 'openapi.ts');
const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

mkdirSync(generatedDirectory, { recursive: true });

const bundleResult = spawnSync(
  pnpmExecutable,
  ['exec', 'redocly', 'bundle', openApiPath, '--output', bundledPath, '--ext', 'json'],
  { cwd: repositoryRoot, encoding: 'utf8' },
);

if (bundleResult.status !== 0) {
  if (bundleResult.stdout.length > 0) {
    console.error(bundleResult.stdout);
  }
  if (bundleResult.stderr.length > 0) {
    console.error(bundleResult.stderr);
  }
  process.exitCode = bundleResult.status ?? 1;
} else {
  const document = JSON.parse(readFileSync(bundledPath, 'utf8'));
  rmSync(bundledPath, { force: true });

  const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
  const quote = (value) => JSON.stringify(value);

  const decodePointer = (segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~');
  const resolveReference = (node) => {
    if (!isRecord(node) || typeof node.$ref !== 'string' || !node.$ref.startsWith('#/')) {
      return node;
    }

    let current = document;
    for (const segment of node.$ref.slice(2).split('/').map(decodePointer)) {
      if (!isRecord(current) || !(segment in current)) {
        throw new Error(`Unable to resolve OpenAPI reference: ${node.$ref}`);
      }
      current = current[segment];
    }
    return current;
  };

  const schemaToType = (input) => {
    const schema = resolveReference(input);
    if (!isRecord(schema)) {
      return 'unknown';
    }

    if (typeof input?.$ref === 'string' && input.$ref.startsWith('#/components/schemas/')) {
      const name = input.$ref.slice('#/components/schemas/'.length);
      return `components['schemas'][${quote(name)}]`;
    }
    if ('const' in schema) {
      return JSON.stringify(schema.const);
    }
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
    }
    if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
      return schema.oneOf.map(schemaToType).join(' | ');
    }
    if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
      return schema.anyOf.map(schemaToType).join(' | ');
    }
    if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
      return schema.allOf.map(schemaToType).join(' & ');
    }

    const rawTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const typeParts = rawTypes
      .filter((value) => typeof value === 'string')
      .map((type) => {
        switch (type) {
          case 'null':
            return 'null';
          case 'string':
            return 'string';
          case 'number':
          case 'integer':
            return 'number';
          case 'boolean':
            return 'boolean';
          case 'array':
            return `readonly (${schemaToType(schema.items)})[]`;
          case 'object': {
            const required = new Set(Array.isArray(schema.required) ? schema.required : []);
            const properties = isRecord(schema.properties) ? schema.properties : {};
            const members = Object.entries(properties).map(
              ([name, propertySchema]) =>
                `${quote(name)}${required.has(name) ? '' : '?'}: ${schemaToType(propertySchema)};`,
            );
            if (schema.additionalProperties === true) {
              members.push('[key: string]: unknown;');
            } else if (isRecord(schema.additionalProperties)) {
              members.push(`[key: string]: ${schemaToType(schema.additionalProperties)};`);
            }
            return members.length === 0
              ? 'Readonly<Record<string, unknown>>'
              : `Readonly<{ ${members.join(' ')} }>`;
          }
          default:
            return 'unknown';
        }
      });

    if (typeParts.length > 0) {
      return [...new Set(typeParts)].join(' | ');
    }
    if (isRecord(schema.properties)) {
      return schemaToType({ ...schema, type: 'object' });
    }
    return 'unknown';
  };

  const parameterGroupType = (parameters, location) => {
    const selected = parameters.filter((parameter) => parameter.in === location);
    if (selected.length === 0) {
      return null;
    }
    const members = selected.map((parameter) => {
      const required = location === 'path' || parameter.required === true;
      return `${quote(parameter.name)}${required ? '' : '?'}: ${schemaToType(parameter.schema)};`;
    });
    return `Readonly<{ ${members.join(' ')} }>`;
  };

  const requestType = (pathItem, operation) => {
    const rawParameters = [
      ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
      ...(Array.isArray(operation.parameters) ? operation.parameters : []),
    ];
    const parameters = rawParameters.map(resolveReference).filter(isRecord);
    const groups = [
      ['path', parameterGroupType(parameters, 'path')],
      ['query', parameterGroupType(parameters, 'query')],
      ['headers', parameterGroupType(parameters, 'header')],
    ];
    const members = [];
    for (const [name, type] of groups) {
      if (type !== null) {
        const required =
          name === 'path' ||
          parameters.some(
            (parameter) =>
              parameter.in === (name === 'headers' ? 'header' : name) &&
              parameter.required === true,
          );
        members.push(`${name}${required ? '' : '?'}: ${type};`);
      }
    }

    const requestBody = resolveReference(operation.requestBody);
    if (isRecord(requestBody)) {
      const content = isRecord(requestBody.content) ? requestBody.content : {};
      const media = isRecord(content['application/json']) ? content['application/json'] : null;
      if (media !== null) {
        members.push(
          `body${requestBody.required === true ? '' : '?'}: ${schemaToType(media.schema)};`,
        );
      }
    }

    return members.length === 0
      ? 'Readonly<Record<never, never>>'
      : `Readonly<{ ${members.join(' ')} }>`;
  };

  const responseSchemas = (operation, predicate) => {
    if (!isRecord(operation.responses)) {
      return [];
    }
    const types = [];
    for (const [status, unresolvedResponse] of Object.entries(operation.responses)) {
      if (!predicate(status)) {
        continue;
      }
      const response = resolveReference(unresolvedResponse);
      if (!isRecord(response)) {
        types.push('unknown');
        continue;
      }
      const content = isRecord(response.content) ? response.content : {};
      const media = isRecord(content['application/json']) ? content['application/json'] : null;
      types.push(media === null ? 'unknown' : schemaToType(media.schema));
    }
    return [...new Set(types)];
  };

  const runtimeResponses = (operation) => {
    const output = {};
    if (!isRecord(operation.responses)) {
      return output;
    }
    for (const [status, unresolvedResponse] of Object.entries(operation.responses)) {
      const response = resolveReference(unresolvedResponse);
      const content = isRecord(response?.content) ? response.content : {};
      const media = isRecord(content['application/json']) ? content['application/json'] : null;
      output[status] = media !== null && isRecord(media.schema) ? media.schema : null;
    }
    return output;
  };

  const methods = new Set(['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace']);
  const operationEntries = [];
  const operationTypes = [];
  const seenOperationIds = new Set();
  const paths = isRecord(document.paths) ? document.paths : {};

  for (const [path, rawPathItem] of Object.entries(paths)) {
    const pathItem = resolveReference(rawPathItem);
    if (!isRecord(pathItem)) {
      continue;
    }
    for (const [method, rawOperation] of Object.entries(pathItem)) {
      if (!methods.has(method) || !isRecord(rawOperation)) {
        continue;
      }
      const operationId = rawOperation.operationId;
      if (typeof operationId !== 'string' || operationId.length === 0) {
        throw new Error(
          `Every OpenAPI operation requires operationId: ${method.toUpperCase()} ${path}`,
        );
      }
      if (seenOperationIds.has(operationId)) {
        throw new Error(`Duplicate OpenAPI operationId: ${operationId}`);
      }
      seenOperationIds.add(operationId);

      const security = rawOperation.security ?? document.security;
      const requiresAuth = Array.isArray(security) && security.length > 0;
      const successTypes = responseSchemas(rawOperation, (status) =>
        /^2(?:\d\d|XX)$/u.test(status),
      );
      const errorTypes = responseSchemas(rawOperation, (status) => !/^2(?:\d\d|XX)$/u.test(status));
      operationEntries.push([
        operationId,
        {
          method: method.toUpperCase(),
          path,
          requiresAuth,
          responses: runtimeResponses(rawOperation),
        },
      ]);
      operationTypes.push(
        `${quote(operationId)}: { request: ${requestType(pathItem, rawOperation)}; response: ${successTypes.join(' | ') || 'unknown'}; error: ${errorTypes.join(' | ') || 'unknown'}; };`,
      );
    }
  }

  const schemas = isRecord(document.components?.schemas) ? document.components.schemas : {};
  const schemaMembers = Object.entries(schemas).map(
    ([name, schema]) => `${quote(name)}: ${schemaToType(schema)};`,
  );
  const runtimeOperations = Object.fromEntries(
    operationEntries.sort(([left], [right]) => left.localeCompare(right)),
  );

  const output = `/* eslint-disable */\n/**\n * Generated from docs/api/openapi.yaml by scripts/generate-openapi-types.mjs.\n * Do not edit manually.\n */\nexport const OPENAPI_SOURCE = 'docs/api/openapi.yaml' as const;\n\nexport const OPENAPI_SCHEMAS = ${JSON.stringify(schemas, null, 2)} as const;\n\nexport const OPENAPI_OPERATIONS = ${JSON.stringify(runtimeOperations, null, 2)} as const;\n\nexport interface components {\n  schemas: {\n    ${schemaMembers.join('\n    ')}\n  };\n}\n\nexport interface operations {\n  ${operationTypes.join('\n  ')}\n}\n\nexport type OperationId = keyof operations;\nexport type OperationRequest<Id extends OperationId> = operations[Id]['request'];\nexport type OperationResponse<Id extends OperationId> = operations[Id]['response'];\nexport type OperationErrorResponse<Id extends OperationId> = operations[Id]['error'];\n`;

  writeFileSync(outputPath, output, 'utf8');
  console.log(`Generated ${operationEntries.length} OpenAPI operations at ${outputPath}`);
}
