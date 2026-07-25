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
  readonly onIssueSelectionChange: (value: IssueSelection) => void;
  readonly onIssueNoteChange: (value: string) => void;
  readonly onCall: () => void;
  readonly onNavigate: () => void;
  readonly onArrivePickup: () => void;
  readonly onVerifyPickup: () => void;
  readonly onDepartPickup: () => void;
  readonly onArriveDrop: () => void;
  readonly onComplete: () => void;
  readonly onSubmitIssue: () => void;
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
  onCall,
  onNavigate,
  onArrivePickup,
  onVerifyPickup,
  onDepartPickup,
  onArriveDrop,
  onComplete,
  onSubmitIssue,
}: CaptainActiveDeliveryCardProps): React.JSX.Element {
  const delivering = active.taskStatus === 'IN_TRANSIT' || active.taskStatus === 'AT_DROP';
  const contact = delivering ? active.drop.phoneNumber : active.pickup.phoneNumber;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {delivering
          ? (active.drop.recipientName ?? 'Customer')
          : (active.pickup.recipientName ?? 'Pickup shop')}
      </Text>
      <Text style={styles.meta}>
        Order {active.orderNumber} · {active.taskStatus.replaceAll('_', ' ')}
      </Text>
      <Text style={styles.address}>
        {addressLine(active, delivering ? 'drop' : 'pickup')}
      </Text>

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          disabled={contact === null}
          onPress={onCall}
          style={[styles.secondaryButton, contact === null ? styles.disabled : null]}
        >
          <Text style={styles.secondaryText}>Call</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onNavigate} style={styles.secondaryButton}>
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
          <Text style={styles.panelTitle}>Cash collection</Text>
          <Text
            accessibilityLabel={`Collect exactly ${money(active.totalPaise)}`}
            style={styles.codDue}
          >
            Collect exactly {money(active.totalPaise)}
          </Text>
          <Text style={styles.meta}>
            This amount comes from the server and cannot be edited by the captain.
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: cashConfirmed }}
            onPress={onCashConfirmationChange}
            style={[styles.confirmRow, cashConfirmed ? styles.confirmedRow : null]}
          >
            <Text style={styles.confirmMark}>{cashConfirmed ? '✓' : '○'}</Text>
            <Text style={styles.confirmText}>I collected the exact cash amount shown above</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Customer delivery OTP"
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
          style={styles.dangerButton}
        >
          <Text style={styles.dangerText}>Report or release delivery</Text>
        </Pressable>
      ) : (
        <View accessibilityLabel="Delivery issue escalation" style={styles.issuePanel}>
          <Text accessibilityRole="header" style={styles.panelTitle}>
            Delivery issue
          </Text>
          <Text accessibilityLiveRegion="assertive" style={styles.safetyNotice}>
            Stop in a safe place before using these controls. Do not type while riding.
          </Text>
          <Text style={styles.meta}>
            {isPrePickup(active)
              ? 'Before pickup, an approved reason releases the assignment and returns the order to captain search.'
              : 'After pickup, this reports a problem. It does not cancel the order or ' +
                'reassign package custody.'}
          </Text>
          <View accessibilityRole="radiogroup" style={styles.reasonList}>
            {(isPrePickup(active) ? DELIVERY_RELEASE_REASONS : DELIVERY_PROBLEM_REASONS).map(
              (reason) => {
                const kind = isPrePickup(active) ? 'RELEASE' : 'PROBLEM';
                const selected = issueSelection?.kind === kind && issueSelection.reason === reason;
                const label = kind === 'RELEASE operations'
                  ? RELEASE_LABELS[reason as keyof typeof RELEASE_LABELS]
                  : PROBLEM_LABELS[reason as keyof typeof PROBLEM_LABELS];
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={reason}
                    onPress={() => {
                      onIssueSelectionChange(
                        kind === 'RELEASE'
                          ? { kind, reason: reason as keyof typeof RELEASE_LABELS }
                          : { kind, reason: reason as keyof typeof PROBLEM_LABELS },
                      );
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
            placeholder={
              issueSelection === 'OTHER'
              ? 'Required note for Other reason'
              : 'Optional note for operations'
            }
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
              <Text style={styles.secondaryText}>Back</Text>
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
