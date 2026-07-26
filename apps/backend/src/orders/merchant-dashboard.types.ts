export interface MerchantDashboardSnapshot {
  readonly shop: {
    readonly id: string;
    readonly name: string;
    readonly operationalStatus: string;
    readonly acceptsOnlineOrders: boolean;
  };
  readonly orders: {
    readonly waitingForMerchant: number;
    readonly packing: number;
    readonly readyForPickup: number;
    readonly activeDelivery: number;
    readonly problemReported: number;
  };
  readonly alerts: {
    readonly unacknowledged: number;
  };
  readonly inventory: {
    readonly lowStockVariants: number;
  };
  readonly sales: {
    readonly completedToday: number;
    readonly grossTodayPaise: number;
  };
  readonly generatedAt: string;
}

export interface MerchantDashboardResponse {
  readonly success: true;
  readonly data: {
    readonly dashboard: MerchantDashboardSnapshot;
  };
  readonly meta: {
    readonly requestId: null;
  };
}
