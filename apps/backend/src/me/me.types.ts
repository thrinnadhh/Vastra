import type { AccountType, ProfileStatus } from '../auth/auth.types';

export interface CommonProfileSnapshot {
  readonly id: string;
  readonly accountType: AccountType;
  readonly fullName: string | null;
  readonly phoneNumber: string | null;
  readonly avatarUrl: string | null;
  readonly status: ProfileStatus;
}

export interface CustomerProfileSnapshot {
  readonly dateOfBirth: string | null;
  readonly genderPreference: string | null;
  readonly profileCompleted: boolean;
  readonly defaultAddressId: string | null;
}

export interface MerchantProfileSnapshot {
  readonly legalName: string;
  readonly businessType: string | null;
  readonly onboardingStatus: string;
  readonly kycStatus: string;
  readonly approvedAt: string | null;
}

export interface MerchantShopSnapshot {
  readonly id: string;
  readonly shopCode: string;
  readonly name: string;
  readonly verificationStatus: string;
  readonly operationalStatus: string;
  readonly acceptsOnlineOrders: boolean;
}

export interface CaptainProfileSnapshot {
  readonly captainCode: string;
  readonly kycStatus: string;
  readonly availabilityStatus: string;
  readonly vehicleType: string | null;
  readonly vehicleNumber: string | null;
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
  readonly completedDeliveries: number;
  readonly cashBalancePaise: number;
  readonly approvedAt: string | null;
}

export interface AdminProfileSnapshot {
  readonly employeeCode: string;
  readonly department: string;
  readonly cityScope: readonly string[];
  readonly managerId: string | null;
  readonly twoFactorEnabled: boolean;
}

export interface CurrentAccountProfile {
  readonly fullName: string | null;
  readonly phoneNumber: string | null;
  readonly avatarUrl: string | null;
}

interface CurrentAccountBase {
  readonly id: string;
  readonly email: string | null;
  readonly status: 'ACTIVE';
  readonly profile: CurrentAccountProfile;
}

export interface CustomerRoleProfile extends CustomerProfileSnapshot {
  readonly kind: 'CUSTOMER';
}

export interface MerchantRoleProfile extends MerchantProfileSnapshot {
  readonly kind: 'MERCHANT';
}

export interface CaptainRoleProfile extends CaptainProfileSnapshot {
  readonly kind: 'CAPTAIN';
}

export interface AdminRoleProfile extends AdminProfileSnapshot {
  readonly kind: 'ADMIN';
}

export interface CustomerScope {
  readonly kind: 'CUSTOMER';
}

export interface MerchantScope {
  readonly kind: 'MERCHANT';
  readonly shops: readonly MerchantShopSnapshot[];
}

export interface CaptainScope {
  readonly kind: 'CAPTAIN';
  readonly captainCode: string;
  readonly availabilityStatus: string;
}

export interface AdminScope {
  readonly kind: 'ADMIN';
  readonly department: string;
  readonly cityScope: readonly string[];
}

export interface CustomerCurrentAccount extends CurrentAccountBase {
  readonly accountType: 'CUSTOMER';
  readonly roleProfile: CustomerRoleProfile;
  readonly scope: CustomerScope;
}

export interface MerchantCurrentAccount extends CurrentAccountBase {
  readonly accountType: 'MERCHANT';
  readonly roleProfile: MerchantRoleProfile;
  readonly scope: MerchantScope;
}

export interface CaptainCurrentAccount extends CurrentAccountBase {
  readonly accountType: 'CAPTAIN';
  readonly roleProfile: CaptainRoleProfile;
  readonly scope: CaptainScope;
}

export interface AdminCurrentAccount extends CurrentAccountBase {
  readonly accountType: 'ADMIN';
  readonly roleProfile: AdminRoleProfile;
  readonly scope: AdminScope;
}

export type CurrentAccount =
  CustomerCurrentAccount | MerchantCurrentAccount | CaptainCurrentAccount | AdminCurrentAccount;

export interface GetCurrentAccountResponse {
  readonly success: true;
  readonly data: CurrentAccount;
  readonly meta: {
    readonly requestId: null;
  };
}
