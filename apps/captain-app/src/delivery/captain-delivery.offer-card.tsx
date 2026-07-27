import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DELIVERY_REJECTION_REASONS } from './captain-delivery.types';
import type { CaptainDelivery, DeliveryRejectionReason } from './captain-delivery.types';
import { addressLine, distance, money, REJECTION_LABELS, styles } from './captain-delivery.view';

export function CaptainDeliveryOfferCard({
  offer,
  busy,
  now,
  onAccept,
  onReject,
}: {
  readonly offer: CaptainDelivery;
  readonly busy: boolean;
  readonly now: number;
  readonly onAccept: () => void;
  readonly onReject: (reason: DeliveryRejectionReason) => void;
}): React.JSX.Element {
  const [rejecting, setRejecting] = useState(false);
  const remaining = Math.max(0, Math.ceil((Date.parse(offer.expiresAt) - now) / 1000));

  return (
    <View style={styles.card} testID={`delivery-offer-${offer.assignmentId}`}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{offer.pickup.recipientName ?? 'Pickup shop'}</Text>
        <Text
          accessibilityLabel={`Offer expires in ${String(remaining)} seconds`}
          accessibilityLiveRegion="polite"
          style={styles.timer}
        >
          {remaining}s
        </Text>
      </View>
      <Text style={styles.meta}>
        {distance(offer.pickupDistanceMeters)} · Order {offer.orderNumber}
      </Text>
      <Text style={styles.address}>{addressLine(offer, 'pickup')}</Text>
      <View style={styles.rowBetween}>
        <Text style={styles.earning}>Earn {money(offer.offeredEarningPaise)}</Text>
        <Text style={styles.cod}>Cash order {money(offer.totalPaise)}</Text>
      </View>

      {rejecting ? (
        <View accessibilityLabel="Select offer rejection reason" style={styles.reasonPanel}>
          <Text style={styles.panelTitle}>Why are you declining?</Text>
          <View style={styles.reasonList}>
            {DELIVERY_REJECTION_REASONS.map((reason) => (
              <Pressable
                accessibilityRole="button"
                disabled={busy || remaining === 0}
                key={reason}
                onPress={() => {
                  setRejecting(false);
                  onReject(reason);
                }}
                style={styles.reasonButton}
              >
                <Text style={styles.reasonText}>{REJECTION_LABELS[reason]}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setRejecting(false);
            }}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>Keep this offer</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            disabled={busy || remaining === 0}
            onPress={() => {
              setRejecting(true);
            }}
            style={[styles.secondaryButton, busy || remaining === 0 ? styles.disabled : null]}
          >
            <Text style={styles.secondaryText}>Decline</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy || remaining === 0}
            onPress={onAccept}
            style={[styles.primaryButton, busy || remaining === 0 ? styles.disabled : null]}
          >
            <Text style={styles.primaryText}>{busy ? 'Confirming…' : 'Accept delivery'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
