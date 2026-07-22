export interface UpdateCustomerProfileInput {
  readonly fullName: string;
}

export interface CustomerProfileUpdateSnapshot {
  readonly fullName: string;
  readonly profileCompleted: true;
  readonly updatedAt: string;
}
