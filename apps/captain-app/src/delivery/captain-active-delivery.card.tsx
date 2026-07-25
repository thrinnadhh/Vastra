import { Pressable, Text, TextInput, View } from 'react-native';

import {
  DELIVERY_PROBLEM_REASONS,
  DELIVERY_RELEASE_REASONS,
  type CaptainDelivery,
} from './captain-delivery.types';
import {
  addressLine,
  isPrePickup,
  money,
  PROBLEM_LABELS,
  RELEASE_LABELS,
  styles,
  type IssueSelection,
} from './captain-delivery.view';

interface CaptainActiveDeliveryCardProps {
  readonly active: CaptainDelivery;
  readonly busy: boolean;
  readonly pickupCode: string;
  readonly deliveryOtp: string;
  readonly cashConfirmed: boolean;
  readonly issueOpen: boolean;
  readonly issueSelection: IssueSelection | null;
  readonly issueNote: string;
  readonly onPickupCodeChange: (value: string) => void;
  readonly onDeliveryOtpChange: (value: string) => void;
  readonly onCashConfirmationChange: () => void;
  readonly onIssueOpen: () => void;
  readonly onIssueClose: () => void;
  readonly onIssueSelectionChange: (selection: IssueSelection) => void;
  readonly onIssueNoteChange: (value: string) => void;
  readonly onSubmitIssue: () => void;
  readonly onArrivePickup: () => void;
  readonly onVerifyPickup: () => void;
  readonly onDepartPickup: () => void;
  readonly onArriveDrop: () => void;
  readonly onComplete: () => void;
  readonly onCall: () => void;
  readonly onNavigate: () => void;
}

function deliveryTarget(active: CaptainDelivery): 'pickup' | 'drop' {
  return active.taskStatus === 'IN_TRANSIT' || active.taskStatus === 'AT_DROP'
    ? 'drop'
    : 'pickup';
}

export function CaptainActiveDeliveryCard({
  active,
  busy,
  pickupCode,
  deliveryOtp,
  cashConfirmed,
  issueOpen,
  issueSelection,
  issueNote,
  onPickupCodeChange,
  onDeliveryOtpChange,
  onCashConfirmationChange,
  onIssueOpen,
  onIssueClose,
  onIssueSelectionChange,
  onIssueNoteChange,
  onSubmitIssue,
  onArrivePickup,
  onVerifyPickup,
  onDepartPickup,
  onArriveDrop,
  onComplete,
  onCall,
  onNavigate,
}: CaptainActiveDeliveryCardProps): React.JSX.Element {
  const target = deliveryTarget(active);
  const selectedOther = issueSelection?.reason === 'OTHER';

  return (
    <View style={styles.card} testID="active-captain-delivery">
      <Text style={styles.cardTitle}>
        {active[target].recipientName ?? (target === 'pickup' ? 'Pickup shop' : 'Customer')}
      </Text>
      <Text style={styles.meta}>
        Order {active.orderNumber} · {active.taskStatus.replaceAll('_', ' ')}
      </Text>
      <Text style={styles.address}>{addressLine(active, target)}</Text>
      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          disabled={active[target].phoneNumber === null}
          onPress={onCall}
          style={[
            styles.secondaryButton,
            active[target].phoneNumber === null ? styles.disabled : null,
          ]}
        >
          <Text style={styles.secondaryText}>Call</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onNavigate}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryText}>Navigate</Text>
        </Pressable>
      </View>

      {active.taskStatus === 'ASSIGNED' ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onArrivePickup}
          style={[styles.primaryButtonFull, busy ? styles.disabled : null]}
        >
          <Text style={styles.primaryText}>I arrived at the shop</Text>
        </Pressable>
      ) : null}

      {active.taskStatus === 'AT_PICKUP' ? (
        <>
          <TextInput
            accessibilityLabel="Merchant pickup code"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={onPickupCodeChange}
            placeholder="6-digit pickup code"
            secureTextEntry
            style={styles.input}
            value={pickupCode}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || pickupCode.length !== 6}
            onPress={onVerifyPickup}
            style={[
              styles.primaryButtonFull,
              busy || pickupCode.length !== 6 ? styles.disabled : null,
            ]}
          >
            <Text style={styles.primaryText}>Verify package handover</Text>
          </Pressable>
        </>
      ) : null}

      {active.taskStatus === 'PICKED_UP' ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onDepartPickup}
          style={[styles.primaryButtonFull, busy ? styles.disabled : null]}
        >
          <Text style={styles.primaryText}>Start customer delivery</Text>
        </Pressable>
      ) : null}

      {active.taskStatus === 'IN_TRANSIT' ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onArriveDrop}
          style={[styles.primaryButtonFull, busy ? styles.disabled : null]}
        >
          <Text style={styles.primaryText}>I arrived at the customer</Text>
        </Pressable>
      ) : null}

      {active.taskStatus === 'AT_DROP' ? (
        <View style={styles.codPanel}>
          <Text accessibilityLabel={`Collect exactly ${money(active.totalPaise)}`} style={styles.codDue}>
            Collect exactly {money(active.totalPaise)}
          </Text>
          <Text style={styles.meta}>
            This amount comes from the order. It cannot be changed by the captain.
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: cashConfirmed }}
            disabled={busy}
            onPress={onCashConfirmationChange}
            style={[styles.confirmRow, cashConfirmed ? styles.confirmedRow : null]}
          >
            <Text style={styles.confirmMark}>{cashConfirmed ? '✓' : '○'}</Text>
            <Text style={styles.confirmText}>I collected the exact cash amount shown above</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Customer delivery OTP"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={onDeliveryOtpChange}
            placeholder="6-digit delivery OTP"
            secureTextEntry
            style={styles.input}
            value={deliveryOtp}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || !cashConfirmed || deliveryOtp.length !== 6}
            onPress={onComplete}
            style={[
              styles.primaryButtonFull,
              busy || !cashConfirmed || deliveryOtp.length !== 6 ? styles.disabled : null,
            ]}
          >
            <Text style={styles.primaryText}>Complete delivery with OTP</Text>
          </Pressable>
        </View>
      ) : null}

      {!issueOpen ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onIssueOpen}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Report or release delivery</Text>
        </Pressable>
      ) : (
        <View style={styles.issuePanel}>
          <Text accessibilityRole="alert" style={styles.safetyNotice}>
            Stop in a safe place before using these controls. Do not type while riding.
          </Text>
          <Text style={styles.panelTitle}>
            {isPrePickup(active) ? 'Release before pickup' : 'Escalate package custody'}
          </Text>
          <Text style={styles.meta}>
            {isPrePickup(active)
              ? 'Releasing returns the order to captain search after the server confirms it.'
              : 'After pickup, this reports a problem. It does not cancel the order or reassign the package.'}
          </Text>
          <View style={styles.reasonList}>
            {(isPrePickup(active) ? DELIVERY_RELEASE_REASONS : DELIVERY_PROBLEM_REASONS).map(
              (reason) => {
                const selection: IssueSelection = isPrePickup(active)
                  ? { kind: 'RELEASE', reason }
                  : { kind: 'PROBLEM', reason };
                const selected =
                  issueSelection?.kind === selection.kind && issueSelection.reason === reason;
                const label = isPrePickup(active)
                  ? RELEASE_LABELS[reason as keyof typeof RELEASE_LABELS]
                  : PROBLEM_LABELS[reason as keyof typeof PROBLEM_LABELS];

                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={reason}
                    onPress={() => {
                      onIssueSelectionChange(selection);
                    }}
                    style={[styles.reasonButton, selected ? styles.selectedReason : null]}
                  >
                    <Text style={styles.reasonText}>{label}</Text>
                  </Pressable>
                );
              },
            )}
          </View>
          <TextInput
            accessibilityLabel="Operational issue note"
            multiline
            onChangeText={onIssueNoteChange}
            placeholder={selectedOther ? 'A note is required for Other' : 'Optional note for operations'}
            style={[styles.input, styles.noteInput]}
            value={issueNote}
          />
          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onIssueClose}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryText}>Close</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy || issueSelection === null}
              onPress={onSubmitIssue}
              style={[
                styles.dangerButton,
                busy || issueSelection === null ? styles.disabled : null,
              ]}
            >
              <Text style={styles.dangerText}>
                {isPrePickup(active) ? 'Release to operations' : 'Escalate to operations'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
