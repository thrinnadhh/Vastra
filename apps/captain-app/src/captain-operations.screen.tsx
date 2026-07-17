import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthenticatedCaptainDeliveryScreen } from './delivery/captain-delivery.screen';
import { AuthenticatedCaptainPresenceScreen } from './presence/captain-presence.screen';

export function CaptainOperationsScreen() {
  const [tab, setTab] = useState<'DELIVERIES' | 'AVAILABILITY'>('DELIVERIES');
  return (
    <View style={styles.root}>
      <View accessibilityRole="tablist" style={styles.tabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'DELIVERIES' }}
          onPress={() => setTab('DELIVERIES')}
          style={[styles.tab, tab === 'DELIVERIES' ? styles.activeTab : null]}
        >
          <Text style={styles.tabText}>Deliveries</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'AVAILABILITY' }}
          onPress={() => setTab('AVAILABILITY')}
          style={[styles.tab, tab === 'AVAILABILITY' ? styles.activeTab : null]}
        >
          <Text style={styles.tabText}>Availability</Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        {tab === 'DELIVERIES' ? (
          <AuthenticatedCaptainDeliveryScreen />
        ) : (
          <AuthenticatedCaptainPresenceScreen />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF8F2' },
  content: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFF8F2',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F6E7DB',
  },
  activeTab: { backgroundColor: '#E9A47E' },
  tabText: { color: '#4A2919', fontWeight: '800' },
});
