import type { z } from 'zod';

export class EnvironmentValidationError extends Error {
  public readonly variableNames: readonly string[];

  public constructor(variableNames: readonly string[]) {
    super(`Invalid environment configuration: ${variableNames.join(', ')}`);
    this.name = 'EnvironmentValidationError';
    this.variableNames = variableNames;
  }
}

export function validateEnvironment<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const variableNames = [
    ...new Set(
      result.error.issues.map((issue) => {
        const path = issue.path.map((part) => String(part)).join('.');
        return path || 'environment';
      }),
    ),
  ].sort();

  throw new EnvironmentValidationError(variableNames);
}
