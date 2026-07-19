const CLIENT_ROOTS = [
  'apps/customer-app/',
  'apps/merchant-app/',
  'apps/captain-app/',
  'apps/admin-dashboard/',
];

const ALLOWED_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.env',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const FORBIDDEN_IDENTIFIERS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
  'CASHFREE_CLIENT_SECRET',
  'CASHFREE_SECRET_KEY',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_SERVICE_ACCOUNT',
  'MSG91_AUTH_KEY',
  'MSG91_PRIVATE_KEY',
];

const FORBIDDEN_VALUE_PATTERNS = [
  {
    label: 'private key material',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  },
  {
    label: 'hard-coded JWT',
    pattern: /["']eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}["']/u,
  },
  {
    label: 'payment secret value',
    pattern: /\b(?:cfsk_[A-Za-z0-9_-]{16,}|sk_(?:test|live)_[A-Za-z0-9_-]{16,})\b/u,
  },
];

export function isClientSourcePath(relativePath) {
  const normalizedPath = relativePath.replaceAll('\\', '/');

  if (!CLIENT_ROOTS.some((root) => normalizedPath.startsWith(root))) {
    return false;
  }

  if (
    normalizedPath.includes('/node_modules/') ||
    normalizedPath.includes('/dist/') ||
    normalizedPath.includes('/build/') ||
    normalizedPath.includes('/coverage/') ||
    normalizedPath.includes('/.expo/')
  ) {
    return false;
  }

  if (normalizedPath.endsWith('.env.example')) {
    return true;
  }

  const finalSegment = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1);
  const extensionIndex = finalSegment.lastIndexOf('.');
  const extension = extensionIndex >= 0 ? finalSegment.slice(extensionIndex) : '';

  return ALLOWED_EXTENSIONS.has(extension);
}

export function scanClientSource(relativePath, contents) {
  const violations = [];
  const lines = contents.split(/\r?\n/u);

  for (const [lineIndex, line] of lines.entries()) {
    for (const identifier of FORBIDDEN_IDENTIFIERS) {
      if (line.includes(identifier)) {
        violations.push({
          path: relativePath,
          line: lineIndex + 1,
          rule: `forbidden privileged identifier ${identifier}`,
        });
      }
    }

    for (const { label, pattern } of FORBIDDEN_VALUE_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          path: relativePath,
          line: lineIndex + 1,
          rule: label,
        });
      }
    }
  }

  return violations;
}
