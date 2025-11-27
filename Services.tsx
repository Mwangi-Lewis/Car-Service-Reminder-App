import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

const RAW_SERVICES = [
  // —— Full list (alphabetized in UI) ——
  'Air Conditioning',
  'Air Filter',
  'Battery Replacement',
  'Brake Fluid',
  'Brake Pad',
  'Coolant',
  'Engine Oil Change',
  'Fuel Filter',
  'Gearbox oil change',
  'Shocks/Springs',
  'Spark Plugs',
  'Tires',
  'Timing Belt/Chain',
  'Wheel Alignment',
  'Wheel Bearing',
];

const SORTED_SERVICES = [...RAW_SERVICES]
  .map(s => s.replace(/\s+/g, ' ').trim())
  .sort((a, b) => a.localeCompare(b));

export default function VehicleServicesList() {
  const { id } = useLocalSearchParams<{ id?: string }>(); // vehicle id (optional)
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!q) return SORTED_SERVICES;
    return SORTED_SERVICES.filter(s => s.toLowerCase().includes(q));
  }, [query]);

  return (
    <SafeAreaView style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#E6E8EB" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Types of Service</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Search */}
        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search service…"
            placeholderTextColor={MUTED}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={20} color={MUTED} />
            </Pressable>
          )}
        </View>

        {/* List */}
        <View style={styles.listCard}>
          {filtered.length === 0 ? (
            <View style={{ padding: 16 }}>
              <Text style={{ color: MUTED, fontWeight: '700' }}>No matching services</Text>
            </View>
          ) : (
            filtered.map((label, i) => (
              <View key={label}>
                <Pressable
                  style={styles.row}
                  android_ripple={{ color: '#ffffff10' }}
                  onPress={() =>
                    router.push({
                      pathname: '/service-detail',
                      params: { name: label, id }, // send service + vehicle id (if present)
                    })
                  }
                >
                  <Text style={styles.rowText}>{label}</Text>
                </Pressable>
                {i < filtered.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom Nav with Icons */}
      <View style={styles.bottomBar}>
        <NavBtn label="Home" icon="home" onPress={() => router.replace('/garage')} />
        <NavBtn label="Services" icon="construct" active onPress={() => {}} />
        <NavBtn
  label="Reminders"
  icon="notifications"
  onPress={() => router.replace('/reminders')}
/>
        <NavBtn label="Service History" icon="time" onPress={() => router.replace('/history')} />
      </View>
    </SafeAreaView>
  );
}

function NavBtn({
  label, icon, onPress, active,
}: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.navBtn}>
      <Ionicons
        name={active ? icon : (`${icon}-outline` as any)}
        size={22}
        color={active ? ACTIVE : MUTED}
        style={{ marginBottom: 4 }}
      />
      <Text style={[styles.navText, active && { color: ACTIVE }]}>{label}</Text>
    </Pressable>
  );
}

/* THEME */
const PAGE_BG = '#0F1115';
const CARD_BG = '#171A1F';
const BORDER = '#2A2F36';
const TEXT = '#E6E8EB';
const MUTED = '#9AA4B2';
const ACTIVE = '#C6D3FF';

/* STYLES */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  backText: { color: TEXT, fontSize: 15, marginLeft: 4, fontWeight: '700' },
  title: { color: TEXT, fontSize: 20, fontWeight: '900', flex: 1, textAlign: 'center', marginRight: 34 },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1, backgroundColor: CARD_BG, borderColor: BORDER, borderWidth: 1, color: TEXT,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  clearBtn: { paddingHorizontal: 6, paddingVertical: 4 },

  listCard: { backgroundColor: CARD_BG, borderRadius: 18, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  row: { paddingHorizontal: 16, paddingVertical: 18 },
  rowText: { color: TEXT, fontSize: 16, fontWeight: '800' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginLeft: 16, opacity: 0.7 },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: '#11141A',
    paddingVertical: 10, paddingHorizontal: 8,
  },
  navBtn: { flex: 1, alignItems: 'center' },
  navText: { color: MUTED, fontSize: 11, fontWeight: '700' },
});
