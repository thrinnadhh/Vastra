import { StyleSheet } from 'react-native';

import type {
  CaptainDelivery,
  DeliveryProblemReason,
  DeliveryRejectionReason,
  DeliveryReleaseReason,
} from './captain-delivery.types';

export const REJECTION_LABELS: Readonly<Record<DeliveryRejectionReason, string>> = {
  TOO_FAR: 'Pickup is too far',
  VEHICLE_ISSUE: 'Vehicle issue',
  SHIFT_ENDING: 'Shift is ending',
  LOW_BATTERY: 'Low battery',
  OTHER: 'Other reason',
};

export const RELEASE_LABELS: Readonly<Record<DeliveryReleaseReason, string>> = {
  VEHICLE_ISSUE: 'Vehicle issue',
  PERSONAL_EMERGENCY: 'Personal emergency',
  CANNOT_REACH_STORE: 'Cannot reach the shop',
  MERCHANT_UNAVAILABLE: 'Merchant unavailable',
  APP_OR_NAVIGATION_FAILURE: 'App or navigation failure',
  OTHER: 'Other reason',
};

export const PROBLEM_LABELS: Readonly<Record<DeliveryProblemReason, string>> = {
  CUSTOMER_UNAVAILABLE: 'Customer unavaile',
  INVALID_ADDRESS: 'Invalid customer address',
  CUSTOMER_REFUSED: 'Customer refused delivery',
  PACKAGE_DAMAGED: 'Package damaged',
  PAYMENT_NOT_AVAILABLE: 'Customer cannot provide payment',
  SAFETY_CONCERN: 'Safety concern',
  VEHICLE_ISSUE: 'Vehicle issue',
  OTHER: 'Other reason',
};

export type IssueSelection =
  | { readonly kind: 'RELEASE'; readonly reason: DeliveryReleaseReason }
  | { readonly kind: 'PROBLEM'; readonly reason: DeliveryProblemReason };

export function money(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function distance(metres: number | null): string {
  if (metres === null) return 'Pickup distance pending';
  if (metres < 1000) return `${String(Math.round(metres))} m away`;
  return `${(metres / 1000).toFixed(1)} km away`;
}

export function addressLine(delivery: CaptainDelivery, target: 'pickup' | 'drop'): string {
  const address = delivery[target];
  const line2 = address.line2 === null ? '' : `, ${address.line2}`;
  return `${address.line1}${line2}, ${address.area}, ${address.city}`;
}

export function isPrePickup(delivery: CaptainDelivery): boolean {
  return delivery.taskStatus === 'ASSIGNED' || delivery.taskStatus === 'AT_PICKUP';
}

export const styles = StyleSheet.create({
  screen: { padding: 20, gap: 14, backgroundColor: '#FFF8F2', flexGrow: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#FFF8F2',
  },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: '#147D65' },
  title: { fontSize: 28, fontWeight: '800', color: '#2F1B12' },
  notice: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF1F0',
    color: '#B42318',
  },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E8',
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#2F1B12' },
  panelTitle: { fontSize: 17, fontWeight: '800', color: '#2F1B12' },
  meta: { fontSize: 14, color: '#6B5143', lineHeight: 20 },
  address: { fontSize: 15, color: '#2F1B12', lineHeight: 21 },
  earning: { fontSize: 17, fontWeight: '800', color: '#147D65' },
  cod: { fontSize: 13, fontWeight: '700', color: '#94600A' },
  codPanel: { gap: 12 },
  codDue: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF8E6',
    fontSize: 20,
    fontWeight: '900',
    color: '#94600A',
  },
  timer: { fontSize: 18, fontWeight: '900', color: '#B42318' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionsRow: { flexDirection: 'row', gap: 10 },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#147D65',
  },
  primaryButtonFull: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#147D65',
  },
  primaryText: { fontWeight: '800', color: '#FFFFFF' },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A9A9B2',
    backgroundColor: '#FFFFFF',
  },
  secondaryText: { fontWeight: '700', color: '#214785' },
  dangerButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF1F0',
  },
  dangerText: { fontWeight: '800', color: '#B42318', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  input: {
    borderWidth: 1,
    borderColor: '#A9A9B2',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2F1B12',
  },
  noteInput: { minHeight: 82, textAlignVertical: 'top' },
  empty: {
    gap: 12,
    alignItems: 'center',
    padding: 24,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: '#2F1B12' },
  reasonPanel: { gap: 10, paddingTop: 4 },
  issuePanel: {
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B42318',
    backgroundColor: '#FAFAFB',
  },
  reasonList: { gap: 8 },
  reasonButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E8',
    backgroundColor: '#FFFFFF',
  },
  selectedReason: { borderColor: '#2857A6', backgroundColor: '#EEF5FF' },
  reasonText: { color: '#2F1B12', fontWeight: '700' },
  safetyNotice: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF8E6',
    color: '#94600A',
    fontWeight: '700',
    lineHeight: 20,
  },
  linkButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: '#214785', fontWeight: '700' },
  confirmRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A9A9B2',
    backgroundColor: '#FFFFFF',
  },
  confirmedRow: { borderColor: '#147D65', backgroundColor: '#ECFDF8' },
  confirmMark: { width: 24, color: '#147D65', fontSize: 20, fontWeight: '900' },
  confirmText: { flex: 1, color: '#2F1B12', fontWeight: '700', lineHeight: 20 },
});
