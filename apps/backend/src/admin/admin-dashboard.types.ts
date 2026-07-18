export interface AdminDashboardSummary {
  readonly openOrders: number;
  readonly interventionOrders: number;
  readonly searchingDeliveries: number;
  readonly activeDeliveries: number;
  readonly openCases: number;
  readonly suspendedMerchants: number;
  readonly suspendedCaptains: number;
  readonly generatedAt: string;
}

export const ADMIN_SEARCH_RESULT_TYPES = [
  'ORDER',
  'DELIVERY_TASK',
  'MERCHANT',
  'CAPTAIN',
  'CASE',
] as const;

export type AdminSearchResultType = (typeof ADMIN_SEARCH_RESULT_TYPES)[number];

export interface AdminSearchResult {
  readonly type: AdminSearchResultType;
  readonly id: string;
  readonly primaryText: string;
  readonly secondaryText: string;
  readonly status: string;
  readonly updatedAt: string;
}
