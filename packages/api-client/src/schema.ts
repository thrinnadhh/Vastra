export type JsonSchema = Readonly<Record<string, unknown>>;
export type SchemaRegistry = Readonly<Record<string, JsonSchema>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const resolveReference = (reference: string, schemas: SchemaRegistry): JsonSchema | null => {
  const prefix = '#/components/schemas/';
  if (!reference.startsWith(prefix)) {
    return null;
  }

  return schemas[reference.slice(prefix.length)] ?? null;
};

const matchesType = (type: string, value: unknown): boolean => {
  switch (type) {
    case 'null':
      return value === null;
    case 'object':
      return isRecord(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return true;
  }
};

const validateObject = (
  schema: JsonSchema,
  value: Record<string, unknown>,
  schemas: SchemaRegistry,
): boolean => {
  const required = Array.isArray(schema['required']) ? schema['required'] : [];
  for (const key of required) {
    if (typeof key !== 'string' || !(key in value)) {
      return false;
    }
  }

  const properties = isRecord(schema['properties']) ? schema['properties'] : {};
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (
      key in value &&
      isRecord(propertySchema) &&
      !validateJsonSchema(propertySchema, value[key], schemas)
    ) {
      return false;
    }
  }

  if (schema['additionalProperties'] === false) {
    return Object.keys(value).every((key) => key in properties);
  }

  const additionalSchema = schema['additionalProperties'];
  if (isRecord(additionalSchema)) {
    for (const [key, item] of Object.entries(value)) {
      if (!(key in properties) && !validateJsonSchema(additionalSchema, item, schemas)) {
        return false;
      }
    }
  }

  return true;
};

export const validateJsonSchema = (
  schema: JsonSchema,
  value: unknown,
  schemas: SchemaRegistry,
): boolean => {
  const reference = schema['$ref'];
  if (typeof reference === 'string') {
    const resolved = resolveReference(reference, schemas);
    return resolved !== null && validateJsonSchema(resolved, value, schemas);
  }

  if ('const' in schema && !Object.is(schema['const'], value)) {
    return false;
  }

  const enumValues = schema['enum'];
  if (Array.isArray(enumValues) && !enumValues.some((item) => Object.is(item, value))) {
    return false;
  }

  const anyOf = schema['anyOf'];
  if (
    Array.isArray(anyOf) &&
    !anyOf.some((item) => isRecord(item) && validateJsonSchema(item, value, schemas))
  ) {
    return false;
  }

  const oneOf = schema['oneOf'];
  if (Array.isArray(oneOf)) {
    const matches = oneOf.filter(
      (item) => isRecord(item) && validateJsonSchema(item, value, schemas),
    ).length;
    if (matches !== 1) {
      return false;
    }
  }

  const allOf = schema['allOf'];
  if (
    Array.isArray(allOf) &&
    !allOf.every((item) => isRecord(item) && validateJsonSchema(item, value, schemas))
  ) {
    return false;
  }

  const rawType = schema['type'];
  if (typeof rawType === 'string' && !matchesType(rawType, value)) {
    return false;
  }
  if (
    Array.isArray(rawType) &&
    !rawType.some((item) => typeof item === 'string' && matchesType(item, value))
  ) {
    return false;
  }

  if ((rawType === 'object' || isRecord(schema['properties'])) && isRecord(value)) {
    return validateObject(schema, value, schemas);
  }

  if (rawType === 'array' && Array.isArray(value)) {
    const items = schema['items'];
    return !isRecord(items) || value.every((item) => validateJsonSchema(items, item, schemas));
  }

  return true;
};
