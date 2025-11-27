import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';

import { auth, db } from '@/src/lib/firebase';
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';

/* THEME */
const PAGE_BG = '#0F1115';
const CARD_BG = '#171A1F';
const BORDER  = '#2A2F36';
const TEXT    = '#E6E8EB';
const MUTED   = '#9AA4B2';
const ACTIVE  = '#C6D3FF';

type HistoryDoc = {
  name: string;
  lastDate?: Timestamp | Date;
  lastDateMs?: number;
  odometerAtService?: number | null;
  intervalKm?: number | null;
  vehicleId?: string;
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<HistoryDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLoading(true);

      // 1) Get all the user’s vehicle ids
      const vehiclesSnap = await getDocs(collection(db, 'users', user.uid, 'vehicles'));
      const vehicleIds = vehiclesSnap.docs.map(d => d.id);

      // 2) For each vehicle, fetch its /history ordered by lastDate desc
      const all: HistoryDoc[] = [];
      for (const vid of vehicleIds) {
        const hq = query(
          collection(db, 'users', user.uid, 'vehicles', vid, 'history'),
          orderBy('lastDate', 'desc')
        );
        const hsnap = await getDocs(hq);
        hsnap.forEach(docSnap => {
          const data = docSnap.data() as any;
          const ts: Timestamp | undefined = data.lastDate;
          all.push({
            name: data.name,
            lastDate: ts,
            lastDateMs: ts ? ts.toMillis() : (data.lastDateMs ?? 0),
            odometerAtService: data.odometerAtService ?? null,
            intervalKm: data.intervalKm ?? null,
            vehicleId: vid,
          });
        });
      }

      // 3) Sort (desc) and set
      all.sort((a, b) => (b.lastDateMs ?? 0) - (a.lastDateMs ?? 0));
      setItems(all);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load history',
        text2: (e?.message || '').replace('Firebase:', '').trim(),
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Service History</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}
      >
        {loading ? (
          <ActivityIndicator color={MUTED} />
        ) : items.length === 0 ? (
          <Text style={{ color: MUTED, fontWeight: '700' }}>No history yet.</Text>
        ) : (
          items.map((h, i) => {
            const d = (h.lastDate as any)?.toDate
              ? (h.lastDate as any).toDate()
              : (h.lastDate ? new Date(h.lastDate as any) : null);
            const dateText = d ? d.toLocaleDateString() : '—';

            return (
              <View key={i} style={styles.card}>
                <Text style={styles.cardTitle}>• {h.name} • {dateText}</Text>
                {h.odometerAtService ? (
                  <Text style={styles.cardLine}>
                    Service was done at: {h.odometerAtService.toLocaleString()} km
                  </Text>
                ) : null}
                {h.intervalKm ? (
                  <Text style={[styles.cardLine, { opacity: 0.9 }]}>
                    Interval: {h.intervalKm.toLocaleString()} km
                  </Text>
                ) : (
                  <Text style={[styles.cardLine, { opacity: 0.5 }]}>—</Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Bottom Nav with Icons (same inline pattern) */}
      <View style={[styles.bottomBar, { paddingBottom: 10 + insets.bottom }]}>
        <NavBtn label="Home" icon="home" onPress={() => router.replace('/garage')} />
        <NavBtn label="Services" icon="construct" onPress={() => router.replace('/services')} />
        <NavBtn label="Reminders" icon="notifications" onPress={() => { /* add route later */ }} />
        <NavBtn label="Service History" icon="time" active onPress={() => {}} />
      </View>
    </SafeAreaView>
  );
}

function NavBtn({
  label,
  icon,
  onPress,
  active,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
}) {
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

/* STYLES */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },

  header: { alignItems: 'center', paddingVertical: 8 },
  title:  { color: TEXT, fontSize: 22, fontWeight: '900' },

  card: {
    backgroundColor: CARD_BG,
    borderColor: BORDER, borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { color: '#7BE495', fontWeight: '900' },
  cardLine:  { color: TEXT, marginTop: 6, fontWeight: '700' },

  bottomBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: '#11141A',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  navBtn: { flex: 1, alignItems: 'center' },
  navText: { color: MUTED, fontSize: 11, fontWeight: '700' },
});
