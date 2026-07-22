import {
  MOBILE_ACCOUNT_TYPES,
  type CurrentAccount,
  type CurrentAccountLookupResult,
  type CurrentAccountPort,
  type MobileAccountType,
} from './session-restoration.types';

type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMobileAccountType(value: unknown): value is MobileAccountType {
  return typeof value === 'string' && MOBILE_ACCOUNT_TYPES.some((candidate) => candidate === value);
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new TypeError('Invalid current account response');
  }

  return value;
}

function parseCurrentAccount(value: unknown): CurrentAccount {
  if (!isRecord(value) || value['success'] !== true) {
    throw new TypeError('Invalid current account response');
  }

  const data = value['data'];

  if (!isRecord(data)) {
    throw new TypeError('Invalid current account response');
  }

  const id = data['id'];
  const accountType = data['accountType'];
  const status = data['status'];
  const profile = data['profile'];
  const roleProfile = data['roleProfile'];

  if (
    typeof id !== 'string' ||
    id.trim().length === 0 ||
    !isMobileAccountType(accountType) ||
    status !== 'ACTIVE' ||
    !isRecord(profile) ||
    !isRecord(roleProfile) ||
    typeof roleProfile['profileCompleted'] !== 'boolean'
  ) {
    throw new TypeError('Invalid current account response');
  }

  return {
    id,
    accountType,
    status,
    fullName: readNullableString(profile, 'fullName'),
    profileCompleted: roleProfile['profileCompleted'],
  };
}

export class HttpCurrentAccountClient implements CurrentAccountPort {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly fetchFunction: FetchFunction = fetch,
  ) {}

  public async getCurrentAccount(accessToken: string): Promise<CurrentAccountLookupResult> {
    try {
      const response = await this.fetchFunction(`${this.apiBaseUrl}/me`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        return { kind: 'INVALID_SESSION' };
      }

      if (response.status === 403) {
        return { kind: 'ACCESS_DENIED' };
      }

      if (!response.ok) {
        return { kind: 'UNAVAILABLE' };
      }

      const body: unknown = await response.json();

      return {
        kind: 'OK',
        account: parseCurrentAccount(body),
      };
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
  }
}
