alter table private.admin_audit_log
  drop constraint if exists admin_audit_log_resource_type_check,
  add constraint admin_audit_log_resource_type_check check (
    resource_type in (
      'ORDER',
      'DELIVERY_TASK',
      'MERCHANT',
      'CAPTAIN',
      'CASE',
      'CONFIGURATION',
      'PAYMENT',
      'PAYMENT_EVENT',
      'RETURN_REQUEST',
      'REFUND',
      'MERCHANT_SETTLEMENT',
      'CAPTAIN_EARNING',
      'CAPTAIN_PAYOUT',
      'COD_RECONCILIATION'
    )
  ),
  drop constraint if exists admin_audit_log_reason_code_check,
  add constraint admin_audit_log_reason_code_check check (
    reason_code in (
      'CUSTOMER_REQUEST',
      'MERCHANT_REQUEST',
      'CAPTAIN_REQUEST',
      'DELIVERY_FAILURE',
      'PAYMENT_RISK',
      'FRAUD_RISK',
      'POLICY_VIOLATION',
      'SAFETY_INCIDENT',
      'OPERATIONAL_RECOVERY',
      'DATA_CORRECTION',
      'PAYMENT_RECOVERY',
      'CUSTOMER_RETURN',
      'RETURN_LOGISTICS',
      'RETURN_INSPECTION',
      'REFUND_DECISION',
      'REFUND_EXECUTION',
      'SETTLEMENT_CYCLE',
      'PAYOUT_CYCLE',
      'COD_RECONCILIATION',
      'FINANCIAL_CORRECTION',
      'FRAUD_REVIEW',
      'OTHER'
    )
  );
