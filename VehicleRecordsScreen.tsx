import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth, db } from '@/src/lib/firebase';
import {
  doc, getDoc, collection, getDocs, query, orderBy, deleteDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';

type CarDoc = {
  manufacturer?: string;
  model?: string;
  year?: number;
  regNo?: string;
  photoUrl?: string;
};

type ServiceDoc = {
  id: string;
  name: string;
  dueDate?: any;     // Firestore Timestamp
  dueKm?: number;
  lastDate?: any;
  odometerAtService?: number;
  intervalKm?: number;
  status?: 'scheduled';
};

const PAGE_BG = '#0F1115';
const CARD_BG = '#171A1F';
const BORDER  = '#2A2F36';
const TEXT    = '#E6E8EB';
const MUTED   = '#9AA4B2';
const ACTIVE  = '#C6D3FF';

export default function VehicleRecordsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [car, setCar] = useState<CarDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [loadingSvc, setLoadingSvc] = useState(false);
  const insets = useSafeAreaInsets();

  // Load vehicle
  useEffect(() => {
    const run = async () => {
      const user = auth.currentUser;
      if (!user || !id) {
        router.replace('/login');
        return;
      }
      try {
        const ref = doc(db, 'users', user.uid, 'vehicles', id);
        const snap = await getDoc(ref);
        setCar(snap.exists() ? (snap.data() as CarDoc) : null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  // Load scheduled services
  const loadServices = async () => {
    const user = auth.currentUser;
    if (!user || !id) return;
    try {
      setLoadingSvc(true);
      const qs = await getDocs(query(
        collection(db, 'users', user.uid, 'vehicles', id, 'services'),
        orderBy('dueDate', 'asc'),
      ));
      const list: ServiceDoc[] = [];
      qs.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
      setServices(list);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load services' });
    } finally {
      setLoadingSvc(false);
    }
  };

  useEffect(() => { loadServices(); }, [id]);

  const today = new Date();
  const [due, coming] = useMemo(() => {
    const d: ServiceDoc[] = [];
    const c: ServiceDoc[] = [];
    services.forEach(s => {
      const dd = s.dueDate?.toDate ? s.dueDate.toDate() : (s.dueDate ? new Date(s.dueDate) : null);
      if (!dd) { c.push(s); return; }
      if (dd < new Date(today.toDateString())) d.push(s); else c.push(s);
    });
    return [d, c];
  }, [services]);

  const markDone = async (svc: ServiceDoc) => {
    const user = auth.currentUser;
    if (!user || !id) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'vehicles', id, 'history'), {
        name: svc.name,
        date: serverTimestamp(),
        lastDate: svc.lastDate ?? svc.dueDate ?? serverTimestamp(),
        odometerAtService: svc.odometerAtService ?? null,
        intervalKm: svc.intervalKm ?? null,
        createdAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'users', user.uid, 'vehicles', id, 'services', svc.id));
      Toast.show({ type: 'success', text1: 'Marked as done' });
      loadServices();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed to mark done', text2: e?.message?.replace('Firebase:', '') });
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#E65A50" size="large" />
      </View>
    );
  }

  const title = [car?.manufacturer, car?.model].filter(Boolean).join(' ');
  const subtitle = car?.year ? String(car.year) : '';

  const List = ({ items }: { items: ServiceDoc[] }) => (
    <View style={styles.cardBox}>
      {loadingSvc ? (
        <ActivityIndicator color={MUTED} />
      ) : items.length === 0 ? (
        <Text style={{ color: MUTED, fontWeight: '700' }}>—</Text>
      ) : (
        items.map(s => {
          const dd = s.dueDate?.toDate ? s.dueDate.toDate() : (s.dueDate ? new Date(s.dueDate) : null);
          return (
            <View key={s.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{s.name}</Text>
                <Text style={styles.rowSub}>
                  {dd ? dd.toLocaleDateString() : '—'} {s.dueKm ? `• ${s.dueKm.toLocaleString()} km` : ''}
                </Text>
              </View>
              <Pressable onPress={() => markDone(s)} style={styles.doneBtn}>
                <Text style={styles.doneText}>Mark done</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header with centered title + profile icon on right */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ width: 28, alignItems: 'flex-start' }}>
          <Ionicons name="arrow-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Vehicle Records</Text>
        <Pressable
          style={styles.profileBtn}
          onPress={() => router.push('/profile')}
          android_ripple={{ color: '#ffffff10', borderless: true }}
        >
          <Ionicons name="person-circle-outline" size={26} color={ACTIVE} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}>
        <Pressable style={styles.photoWrap}>
          {car?.photoUrl ? (
            <Image
              source={{ uri: car.photoUrl }}
              style={{ width: '100%', height: 160, borderRadius: 12 }}
              contentFit="cover"
            />
          ) : (
            <View style={styles.photoPlaceholder}><Text style={styles.photoPhText}>Your Car photo</Text></View>
          )}
        </Pressable>

        <Text style={styles.carTitle}>{title || '—'}</Text>
        {!!subtitle && <Text style={styles.carSub}>{subtitle}</Text>}

        <Text style={styles.sectionTitle}>Due Services</Text>
        <List items={due} />

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Coming Services</Text>
        <List items={coming} />
      </ScrollView>

      {/* Bottom nav with icons */}
      <View style={[styles.bottomBar, { paddingBottom: 10 + insets.bottom }]}>
        <NavBtn label="Home" icon="home" onPress={() => router.replace('/garage')} />
        <NavBtn label="Services" icon="construct" onPress={() => router.push({ pathname: '/services', params: { id } })} />
        <NavBtn label="Reminders" icon="notifications" onPress={() => router.replace('/reminders')} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },
  loader: { flex: 1, backgroundColor: PAGE_BG, alignItems: 'center', justifyContent: 'center' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  headerTitle: { flex: 1, color: TEXT, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  profileBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  photoWrap: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: BORDER, backgroundColor: CARD_BG },
  photoPlaceholder: { height: 160, alignItems: 'center', justifyContent: 'center' },
  photoPhText: { color: MUTED, fontWeight: '700' },

  carTitle: { color: TEXT, fontSize: 18, fontWeight: '900', marginTop: 12 },
  carSub: { color: MUTED, marginTop: 2 },

  sectionTitle: { color: TEXT, fontSize: 14, fontWeight: '800', marginTop: 14, marginBottom: 6 },

  cardBox: { backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 8, minHeight: 80 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10 },
  rowTitle: { color: TEXT, fontWeight: '900' },
  rowSub: { color: MUTED, marginTop: 2, fontSize: 12 },
  doneBtn: { backgroundColor: '#2B7A0B', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  doneText: { color: '#E6FBEA', fontWeight: '800', fontSize: 12 },

  bottomBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: '#11141A',
    paddingVertical: 10, paddingHorizontal: 8,
  },
  navBtn: { flex: 1, alignItems: 'center' },
  navText: { color: MUTED, fontSize: 11, fontWeight: '700' },
});
