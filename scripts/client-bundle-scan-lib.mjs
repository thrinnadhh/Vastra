const BUNDLE_ROOTS = [
  'apps/admin-dashboard/.next/static/',
  'apps/admin-dashboard/.next/server/',
  'apps/customer-app/dist/',
  'apps/merchant-app/dist/',
  'apps/captain-app/dist/',
];

const ALLOWED_BUNDLE_EXTENSIONS = new Set(['.cjs', '.html', '.js', '.json', '.map', '.mjs']);

const BUNDLE_FORBIDDEN_ENV_EXPRESSIONS = [
  'process.env.SUPABASE_SERVICE_ROLE_KEY',
  'process.env.SUPABASE_SECRET_KEY',
  'process.env.DATABASE_URL',
  'process.env.DIRECT_URL',
  'process.env.CASHFREE_CLIENT_SECRET',
  'process.env.CASHFREE_SECRET_KEY',
  'process.env.FIREBASE_PRIVATE_KEY',
  'process.env.FIREBASE_CLIENT_EMAIL',
  'process.env.FIREBASE_SERVICE_ACCOUNT',
  'process.env.MSG91_AUTH_KEY',
  'process.env.MSG91_PRIVATE_KEY',
];

const BUNDLE_FORBIDDEN_VALUE_PATTERNS = [
  {
    label: 'canary secret injected during CI',
    pattern: /\bVAS?STRA_CANARY_[A-Za-z0-9_]+\b/u,
  },
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
  {
    label: 'database URL with credentials',
    pattern: /postgres(?:ql)?:\/\/[^:\s'"]+:[^@\s'"]+@[^\s'"]+/u,
  },
  {
    label: 'embedded authorization header with secret',
    pattern: /Authorization:\s*Bearer\s+(?:cfsk_|sk_|eyJ)[A-Za-z0-9_.-]+/u,
  },
  {
    label: 'firebase service account field',
    pattern: /"private_key_id"\s*:\s*["'][^"']+["']/u,
  },
  {
    label: 'secret environment-variable assignment in bundle',
    pattern:
      /\b(?:SUPABASE_SERVICE_ROLE_KEY|CASHFREE_CLIENT_SECRET|FIREBASE_PRIVATE_KEY|MSG91_AUTH_KEY)\s*[:=]\s*["'][^"']{8,}["']/u,
  },
];

export function isClientBundlePath(relativePath) {
  const normalizedPath = relativePath.replaceAll('\\', '/');

  if (!BUNDLE_ROOTS.some((root) => normalizedPath.startsWith(root))) {
    return false;
  }

  const finalSegment = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1);
  const extensionIndex = finalSegment.lastIndexOf('.');
  const extension = extensionIndex >= 0 ? finalSegment.slice(extensionIndex) : '';

  return ALLOWED_BUNDLE_EXTENSIONS.has(extension);
}

export function scanClientBundle(relativePath, contents) {
  const violations = [];
  const lines = contents.split(/\r?\n/u);
  const isMapFile = relativePath.endsWith('.map');

  for (const [lineIndex, line] of lines.entries()) {
    if (!isMapFile) {
      for (const expression of BUNDLE_FORBIDDEN_ENV_EXPRESSIONS) {
        if (line.includes(expression)) {
          violations.push({
            path: relativePath,
            line: lineIndex + 1,
            rule: `forbidden secret env expression ${expression} in bundle`,
          });
        }
      }
    }

    for (const { label, pattern } of BUNDLE_FORBIDDEN_VALUE_PATTERNS) {
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
