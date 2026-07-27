import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HardenedAuthenticatedCaptainDeliveryScreen } from './delivery/hardened-captain-delivery.screen';
import { HardenedAuthenticatedCaptainPresenceScreen } from './presence/hardened-captain-presence.screen';

export function CaptainOperationsScreen(): React.JSX.Element {
  const [tab, setTab] = useState<'DELIVERIES' | 'AVAILABILITY'>('DELIVERIES');

  return (
    <View style={styles.root}>
      <View
        accessibilityLabel="Captain operations sections"
        accessibilityRole="tablist"
        style={styles.tabs}
      >
        <Pressable
          accessibilityLabel="Deliveries tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'DELIVERIES' }}
          onPress={() => {
            setTab('DELIVERIES');
          }}
          style={[styles.tab, tab === 'DELIVERIES' ? styles.activeTab : null]}
        >
          <Text style={styles.tabText}>Deliveries</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Availability tab"
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'AVAILABILITY' }}
          onPress={() => {
            setTab('AVAILABILITY');
          }}
          style={[styles.tab, tab === 'AVAILABILITY' ? styles.activeTab : null]}
        >
          <Text style={styles.tabText}>Availability</Text>
        </Pressable>
      </View>
      <View style={styles.content}>
        {tab === 'DELIVERIES' ? (
          <HardenedAuthenticatedCaptainDeliveryScreen />
        ) : (
          <HardenedAuthenticatedCaptainPresenceScreen />
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
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E8',
    backgroundColor: '#F4F4F6',
  },
  activeTab: { borderColor: '#147D65', backgroundColor: '#ECFDF8' },
  tabText: { color: '#2F1B12', fontWeight: '800' },
});
