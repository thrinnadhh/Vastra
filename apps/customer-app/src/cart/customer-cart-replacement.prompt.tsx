import { Pressable, StyleSheet, Text, View } from 'react-native';

export function CustomerCartReplacementPrompt({
  currentShopName,
  nextShopName,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  readonly currentShopName: string;
  readonly nextShopName: string;
  readonly isSubmitting: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`Replace ${currentShopName} cart with ${nextShopName} cart`}
      accessibilityLiveRegion="polite"
      style={styles.card}
    >
      <Text accessibilityRole="header" style={styles.title}>
        Start a new shop cart?
      </Text>
      <Text style={styles.message}>
        Your current items from {currentShopName} must be cleared before adding an item from{' '}
        {nextShopName}.
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Keep current cart"
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={onCancel}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>Keep cart</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Clear ${currentShopName} cart and continue with ${nextShopName}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting }}
          disabled={isSubmitting}
          onPress={onConfirm}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>
            {isSubmitting ? 'Replacing…' : 'Clear and continue'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF' },
  title: { color: '#1F2937', fontSize: 20, fontWeight: '700' },
  message: { marginTop: 8, color: '#667085', fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  secondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  secondaryText: { color: '#475467', fontSize: 14, fontWeight: '700' },
  primary: {
    minHeight: 44,
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#6C3AA8',
  },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
