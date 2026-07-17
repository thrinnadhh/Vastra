export interface MerchantAlertScheduleSummary {
  readonly processed: number;
  readonly remindersQueued: number;
  readonly expired: number;
  readonly stopped: number;
}

export interface MerchantAlertSchedulerGateway {
  processDueAlerts(workerId: string, limit: number): Promise<MerchantAlertScheduleSummary>;
}
