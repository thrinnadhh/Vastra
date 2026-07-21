export type PresentationMode = 'brand' | 'commerce' | 'hybrid';
export type MobileApplicationRole = 'customer' | 'merchant' | 'captain';
export type SafeAreaEdge = 'top' | 'right' | 'bottom' | 'left';

export interface MobileShellContractInput {
  readonly role: MobileApplicationRole;
  readonly mode?: PresentationMode;
  readonly keyboardAware?: boolean;
  readonly scrollable?: boolean;
  readonly hasHeader?: boolean;
  readonly hasFooter?: boolean;
  readonly hasOverlay?: boolean;
}

export interface MobileShellContract {
  readonly kind: 'mobileApplicationShell';
  readonly role: MobileApplicationRole;
  readonly mode: PresentationMode;
  readonly safeAreaEdges: readonly SafeAreaEdge[];
  readonly keyboardAware: boolean;
  readonly scrollable: boolean;
  readonly keyboardShouldPersistTaps: 'handled';
  readonly hasHeader: boolean;
  readonly hasFooter: boolean;
  readonly hasOverlay: boolean;
  readonly overlayAfterContent: true;
}

const ALL_SAFE_AREA_EDGES = ['top', 'right', 'bottom', 'left'] as const;

export function createMobileShellContract(input: MobileShellContractInput): MobileShellContract {
  const mode = input.mode ?? 'commerce';
  if (input.role !== 'customer' && mode !== 'commerce') {
    throw new Error('Merchant and captain application shells must use Commerce mode');
  }

  return {
    kind: 'mobileApplicationShell',
    role: input.role,
    mode,
    safeAreaEdges: ALL_SAFE_AREA_EDGES,
    keyboardAware: input.keyboardAware ?? true,
    scrollable: input.scrollable ?? false,
    keyboardShouldPersistTaps: 'handled',
    hasHeader: input.hasHeader ?? false,
    hasFooter: input.hasFooter ?? false,
    hasOverlay: input.hasOverlay ?? false,
    overlayAfterContent: true,
  };
}

export interface AdminNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly current?: boolean;
}

export interface AdminShellContractInput {
  readonly productLabel: string;
  readonly navigation: readonly AdminNavigationItem[];
  readonly mainContentId?: string;
  readonly hasSecondaryPanel?: boolean;
}

export interface AdminShellContract {
  readonly kind: 'adminApplicationShell';
  readonly productLabel: string;
  readonly navigation: readonly AdminNavigationItem[];
  readonly mainContentId: string;
  readonly skipLinkHref: string;
  readonly navigationLabel: 'Admin navigation';
  readonly hasSecondaryPanel: boolean;
}

export function createAdminShellContract(input: AdminShellContractInput): AdminShellContract {
  const productLabel = requireText(input.productLabel, 'productLabel');
  if (input.navigation.length === 0) {
    throw new Error('Admin application shell requires at least one navigation item');
  }

  const hrefs = new Set<string>();
  let currentCount = 0;
  const navigation = input.navigation.map((item) => {
    const href = requirePath(item.href);
    const label = requireText(item.label, 'navigation label');
    if (hrefs.has(href)) {
      throw new Error(`Duplicate admin navigation href: ${href}`);
    }
    hrefs.add(href);
    if (item.current === true) {
      currentCount += 1;
    }
    return item.current === true ? { href, label, current: true as const } : { href, label };
  });

  if (currentCount > 1) {
    throw new Error('Admin application shell allows at most one current navigation item');
  }

  const mainContentId = requireIdentifier(input.mainContentId ?? 'admin-main-content');
  return {
    kind: 'adminApplicationShell',
    productLabel,
    navigation,
    mainContentId,
    skipLinkHref: `#${mainContentId}`,
    navigationLabel: 'Admin navigation',
    hasSecondaryPanel: input.hasSecondaryPanel ?? false,
  };
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${field} must not be empty`);
  }
  return normalized;
}

function requireIdentifier(value: string): string {
  const normalized = requireText(value, 'mainContentId');
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(normalized)) {
    throw new Error('mainContentId must be a valid HTML identifier');
  }
  return normalized;
}

function requirePath(value: string): string {
  const normalized = requireText(value, 'navigation href');
  if (!normalized.startsWith('/')) {
    throw new Error('Admin navigation hrefs must be application-relative paths');
  }
  return normalized;
}
