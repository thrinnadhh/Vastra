const BEARER_TOKEN_PATTERN = /^Bearer[ \t]+(\S+)$/iu;

export function extractBearerToken(
  authorization: string | readonly string[] | undefined,
): string | null {
  if (authorization === undefined) {
    return null;
  }

  let headerValue: string;

  if (typeof authorization === 'string') {
    headerValue = authorization;
  } else {
    if (authorization.length !== 1) {
      return null;
    }

    const firstValue = authorization[0];

    if (firstValue === undefined) {
      return null;
    }

    headerValue = firstValue;
  }

  const match = BEARER_TOKEN_PATTERN.exec(headerValue.trim());

  return match?.[1] ?? null;
}
