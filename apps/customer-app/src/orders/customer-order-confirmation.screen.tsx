import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatPaiseAsInr } from '../checkout/format-inr';
import { getCustomerOrderStatusPresentation } from './customer-order-status';
import type { CustomerOrderDetail, CustomerOrderItem } from './customer-order.types';

export interface CustomerOrderConfirmationScreenProps {
  readonly order: CustomerOrderDetail;
  readonly onViewOrder: (orderId: string) => void;
  readonly onViewOrders: () => void;
  readonly onContinueShopping: () => void;
}

function formatPlacedAt(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function variantLabel(item: CustomerOrderItem): string {
  return [item.colourName, item.sizeLabel, item.sku]
    .filter((value): value is string => value !== null)
    .join(' · ');
}

function MoneyRow({ label, paise }: { readonly label: string; readonly paise: number }) {
  const formatted = formatPaiseAsInr(paise);
  return (
    <View accessible accessibilityLabel={`${label} ${formatted}`} style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{formatted}</Text>
    </View>
  );
}

export function CustomerOrderConfirmationScreen({
  order,
  onViewOrder,
  onViewOrders,
  onContinueShopping,
}: CustomerOrderConfirmationScreenProps) {
  const status = getCustomerOrderStatusPresentation(order.status);
  const placedAt = order.placedAt ?? order.createdAt;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>ORDER CONFIRMED</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Your COD order was placed
      </Text>
      <Text accessibilityLabel={`Order number ${order.orderNumber}`} style={styles.orderNumber}>
        {order.orderNumber}
      </Text>

      <View
        accessible
        accessibilityLabel={`Current order status ${status.title}. ${status.description}`}
        accessibilityLiveRegion="polite"
        style={styles.card}
      >
        <Text style={styles.sectionLabel}>CURRENT STATUS</Text>
        <Text style={styles.status}>{status.title}</Text>
        <Text style={styles.secondary}>{status.description}</Text>
        <Text style={styles.secondary}>Placed {formatPlacedAt(placedAt)}</Text>
        <Text style={styles.secondary}>Payment: Cash on Delivery</Text>
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {order.shop.name}
        </Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={styles.itemCopy}>
              <Text style={styles.itemName}>{item.productName}</Text>
              <Text style={styles.secondary}>{variantLabel(item)}</Text>
              <Text style={styles.secondary}>Quantity {item.quantity}</Text>
            </View>
            <Text style={styles.itemTotal}>{formatPaiseAsInr(item.totalPaise)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Delivery address
        </Text>
        <Text style={styles.itemName}>{order.address.recipientName}</Text>
        <Text style={styles.secondary}>{order.address.phoneNumber}</Text>
        <Text style={styles.secondary}>{order.address.line1}</Text>
        {order.address.line2 === null ? null : (
          <Text style={styles.secondary}>{order.address.line2}</Text>
        )}
        <Text style={styles.secondary}>
          {order.address.area}, {order.address.city}, {order.address.state}{' '}
          {order.address.postalCode}
        </Text>
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Pay on delivery
        </Text>
        <MoneyRow label="Subtotal" paise={order.totals.subtotalPaise} />
        <MoneyRow label="Product discount" paise={order.totals.productDiscountPaise} />
        <MoneyRow label="Coupon discount" paise={order.totals.couponDiscountPaise} />
        <MoneyRow label="Delivery fee" paise={order.totals.deliveryFeePaise} />
        <MoneyRow label="Platform fee" paise={order.totals.platformFeePaise} />
        <MoneyRow label="Tax" paise={order.totals.taxPaise} />
        <MoneyRow label="COD total" paise={order.totals.totalPaise} />
      </View>

      <Pressable
        accessibilityLabel={`View order ${order.orderNumber}`}
        accessibilityRole="button"
        onPress={() => {
          onViewOrder(order.id);
        }}
        style={styles.primaryAction}
      >
        <Text style={styles.primaryActionText}>View order details</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Open My Orders"
        accessibilityRole="button"
        onPress={onViewOrders}
        style={styles.secondaryAction}
      >
        <Text style={styles.secondaryActionText}>My Orders</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Continue shopping"
        accessibilityRole="button"
        onPress={onContinueShopping}
        style={styles.secondaryAction}
      >
        <Text style={styles.secondaryActionText}>Continue shopping</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
    backgroundColor: '#F7F8FA',
  },
  eyebrow: { color: '#18794E', fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  title: { marginTop: 8, color: '#1F2937', fontSize: 28, fontWeight: '700' },
  orderNumber: { marginTop: 10, color: '#6C3AA8', fontSize: 18, fontWeight: '700' },
  card: {
    marginTop: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  sectionLabel: { color: '#667085', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sectionTitle: { marginBottom: 12, color: '#1F2937', fontSize: 18, fontWeight: '700' },
  status: { marginTop: 6, color: '#18794E', fontSize: 17, fontWeight: '700' },
  secondary: { marginTop: 4, color: '#667085', fontSize: 14, lineHeight: 20 },
  item: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  itemCopy: { flex: 1, paddingRight: 12 },
  itemName: { color: '#1F2937', fontSize: 15, fontWeight: '600' },
  itemTotal: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  label: { color: '#667085', fontSize: 14 },
  value: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  primaryAction: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#6C3AA8',
  },
  primaryActionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryActionText: { color: '#6C3AA8', fontSize: 15, fontWeight: '700' },
});
