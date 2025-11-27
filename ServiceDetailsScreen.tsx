import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';

import { auth, db } from '@/src/lib/firebase';
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { scheduleOneShot } from '@/src/lib/notifications';

const PAGE_BG = '#0F1115';
const CARD_BG = '#171A1F';
const BORDER = '#2A2F36';
const TEXT = '#E6E8EB';
const MUTED = '#9AA4B2';
const ACCENT = '#7BE495';
const ACTIVE = '#C6D3FF';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

const SERVICE_RECS: Record<string, { subtitle: string; defaultKm?: number }> = {
  [norm('Engine Oil')]: { subtitle: 'Change every 10,000 km', defaultKm: 10000 },
  [norm('Gearbox Oil')]: { subtitle: 'Change every 50,000 km', defaultKm: 50000 },
  [norm('Tires')]: { subtitle: 'Town: 50k–80k km • Off-road: 40k–50k km' },
  [norm('Battery Replacement')]: {
    subtitle: 'Car batteries last 2–3 years. Replace earlier if voltage drops.',
  },
  [norm('Shocks/Springs')]: {
    subtitle: 'Town: 50k–60k km • Off-road: 30k–40k km',
  },
  [norm('Brake Pad')]: { subtitle: 'Replace every 30,000–70,000 km' },
  [norm('Coolant')]: { subtitle: 'Replace every 60,000 km', defaultKm: 60000 },
  [norm('Spark Plugs')]: { subtitle: 'Replace every 30,000–90,000 km' },
  [norm('Wheel Bearing')]: { subtitle: 'Inspect every 50,000–80,000 km' },
  [norm('Timing Belt/Chain')]: {
    subtitle: 'Inspect/replace every 100,000–160,000 km',
  },
  [norm('Wheel Alignment')]: {
    subtitle: 'Check every 10,000 km',
    defaultKm: 10000,
  },
  [norm('Air Filter')]: { subtitle: 'Replace during engine oil change' },
  [norm('Air Conditioning')]: {
    subtitle: 'Inspect service system (filter/dryer as needed)',
  },
  [norm('Oil Change')]: { subtitle: 'Change every 10,000 km', defaultKm: 10000 },
  [norm('Fuel Filter')]: { subtitle: 'Replace every 30,000–60,000 km' },
  [norm('Tire Pressure')]: { subtitle: 'Check regularly' },
  [norm('Inspection')]: { subtitle: 'General check as needed / schedule' },
  [norm('Car Wash')]: { subtitle: 'As needed' },
  [norm('Lights')]: { subtitle: 'Inspect every service' },
  [norm('Gearbox oil change')]: {
    subtitle: 'Change every 50,000 km',
    defaultKm: 50000,
  },
};

export default function ServiceDetailScreen() {
  const { name, service, id } =
    useLocalSearchParams<{ name?: string; service?: string; id?: string }>();
  const label = (name || service || 'Service').replace(/\s+/g, ' ').trim();
  const rec = SERVICE_RECS[norm(label)] ?? { subtitle: '—' };
  const isBattery = norm(label) === norm('Battery Replacement');
  const insets = useSafeAreaInsets();

  // Form state
  const [lastDate, setLastDate] = useState<Date | null>(null); // when you LAST did the service
  const [showPicker, setShowPicker] = useState(false);
  const [odometer, setOdometer] = useState<string>(''); // at last service
  const [intervalKm, setIntervalKm] = useState<string>(
    rec.defaultKm ? String(rec.defaultKm) : '',
  );
  const [avgMonthly, setAvgMonthly] = useState<string>(''); // km/month (optional)
  const [saving, setSaving] = useState(false);

  // Compute Next Due (km & date)
  const preview = useMemo(() => {
    // Battery: time-based only
    if (isBattery) {
      if (!lastDate) return '—';
      const next = new Date(lastDate);
      next.setFullYear(next.getFullYear() + 2); // 2-year rule
      return next.toLocaleDateString();
    }

    // Other services: km + optional date estimate
    const odo = Number(odometer.replace(/[^0-9]/g, '')) || 0;
    const ivk = Number(intervalKm.replace(/[^0-9]/g, '')) || 0;
    const nextKm = odo && ivk ? odo + ivk : null;

    let nextDateStr = '—';
    if (lastDate && ivk && Number(avgMonthly) > 0) {
      const months = ivk / Number(avgMonthly);
      const d = new Date(lastDate);
      d.setMonth(d.getMonth() + Math.max(1, Math.round(months)));
      nextDateStr = d.toLocaleDateString();
    } else if (lastDate) {
      nextDateStr = lastDate.toLocaleDateString();
    }

    const kmStr = nextKm ? `${nextKm.toLocaleString()} km` : '— km';
    return `${kmStr} • ${nextDateStr}`;
  }, [isBattery, lastDate, odometer, intervalKm, avgMonthly]);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      Toast.show({ type: 'error', text1: 'Not signed in' });
      return;
    }
    if (!id) {
      Toast.show({ type: 'error', text1: 'Vehicle not found' });
      return;
    }

    const vehicleId = String(id);

    // 🔋 BATTERY REPLACEMENT BRANCH
    if (isBattery) {
      if (!lastDate) {
        Toast.show({
          type: 'info',
          text1: 'Select the last battery replacement date',
        });
        return;
      }

      // next replacement = +2 years
      const dueDate = new Date(lastDate);
      dueDate.setFullYear(dueDate.getFullYear() + 2);

      setSaving(true);
      try {
        // 1) save scheduled battery service
        const servicesCol = collection(
          db,
          'users',
          user.uid,
          'vehicles',
          vehicleId,
          'services',
        );
        const svcRef = await addDoc(servicesCol, {
          name: label,
          type: 'battery',
          lastDate: Timestamp.fromDate(lastDate),
          odometerAtService: null,
          intervalKm: null,
          avgMonthlyKm: null,
          dueKm: null,
          dueDate: Timestamp.fromDate(dueDate),
          status: 'scheduled',
          createdAt: serverTimestamp(),
        });

        // 2) schedule local notification
        let scheduledId: string | null = null;
        try {
          scheduledId = await scheduleOneShot({
            title: 'Battery replacement',
            body: `Battery replacement due on ${dueDate.toLocaleDateString()}. Remember to check voltage regularly.`,
            fireDate: dueDate,
            data: {
              vehicleId,
              serviceId: svcRef.id,
              type: 'batteryReminder',
            },
          });
        } catch (e) {
          console.warn('Failed to schedule battery notification', e);
        }

        // 3) create reminder doc
        const remindersCol = collection(db, 'users', user.uid, 'reminders');
        await addDoc(remindersCol, {
          title: 'Battery replacement',
          vehicleId,
          vehicleName: null,
          dueAt: Timestamp.fromDate(dueDate),
          dueKm: null,
          status: 'pending',
          scheduledId: scheduledId ?? null,
          createdAt: serverTimestamp(),
          completedAt: null,
          kind: 'battery',
        });

        Toast.show({
          type: 'success',
          text1: 'Battery service & reminder saved',
        });
        router.back();
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: 'Save failed',
          text2: e?.message?.replace('Firebase:', ''),
        });
      } finally {
        setSaving(false);
      }

      return;
    }

    // 🛠 NON-BATTERY SERVICES (original logic)
    const ivk = Number(intervalKm.replace(/[^0-9]/g, ''));
    const odo = Number(odometer.replace(/[^0-9]/g, ''));
    if (!ivk || !odo || !lastDate) {
      Toast.show({
        type: 'info',
        text1: 'Enter date, odometer and interval',
      });
      return;
    }

    // Calculate next due date if avgMonthly provided
    let dueDate: Date | null = null;
    if (Number(avgMonthly) > 0) {
      const months = ivk / Number(avgMonthly);
      const d = new Date(lastDate);
      d.setMonth(d.getMonth() + Math.max(1, Math.round(months)));
      dueDate = d;
    }

    const nextKm = odo + ivk;
    const nextDate = dueDate ?? lastDate; // fallback to lastDate if we can't estimate

    setSaving(true);
    try {
      // 1) Save scheduled service under the vehicle
      const servicesCol = collection(
        db,
        'users',
        user.uid,
        'vehicles',
        vehicleId,
        'services',
      );
      const serviceRef = await addDoc(servicesCol, {
        name: label,
        lastDate: Timestamp.fromDate(lastDate),
        odometerAtService: odo,
        intervalKm: ivk,
        avgMonthlyKm: Number(avgMonthly) || null,
        dueKm: nextKm,
        dueDate: Timestamp.fromDate(nextDate),
        status: 'scheduled',
        createdAt: serverTimestamp(),
      });

      // 2) Schedule a local notification for the due date
      let scheduledId: string | null = null;
      try {
        scheduledId = await scheduleOneShot({
          title: `${label} service`,
          body: `Due on ${nextDate.toLocaleDateString()} at ${nextKm.toLocaleString()} km`,
          fireDate: nextDate,
          data: {
            vehicleId,
            serviceId: serviceRef.id,
            type: 'serviceReminder',
          },
        });
      } catch (e) {
        console.warn('Failed to schedule notification', e);
      }

      // 3) Create a Reminder document that RemindersScreen will read
      const remindersCol = collection(db, 'users', user.uid, 'reminders');
      await addDoc(remindersCol, {
        title: label,
        vehicleId,
        vehicleName: null, // you can fill this later with the car name
        dueAt: Timestamp.fromDate(nextDate),
        dueKm: nextKm,
        status: 'pending',
        scheduledId: scheduledId ?? null,
        createdAt: serverTimestamp(),
        completedAt: null,
      });

      Toast.show({ type: 'success', text1: 'Service & reminder saved' });
      router.back();
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Save failed',
        text2: e?.message?.replace('Firebase:', ''),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>{label}</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Subtitle */}
      <Text style={styles.subtitle}>{rec.subtitle}</Text>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date of LAST service */}
        <Text style={styles.fieldLabel}>Date of service</Text>
        <Pressable style={styles.dateInput} onPress={() => setShowPicker(true)}>
          <Text style={lastDate ? styles.dateText : styles.placeholder}>
            {lastDate ? lastDate.toLocaleDateString() : 'Select Date'}
          </Text>
          <Ionicons name="calendar" size={18} color={MUTED} />
        </Pressable>

        {showPicker && (
          <DateTimePicker
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            value={lastDate ?? new Date()}
            onChange={(_, d) => {
              setShowPicker(false);
              if (d) setLastDate(d);
            }}
            maximumDate={new Date()} // last service date shouldn't be in the future
          />
        )}

        {/* Battery vs normal form */}
        {isBattery ? (
          <>
            <Text style={[styles.helperMuted, { marginTop: 12 }]}>
              Note: Most car batteries last 2–3 years. Check voltage regularly
              and replace earlier if voltage drops below normal.
            </Text>
          </>
        ) : (
          <>
            {/* Odometer at service */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
              Odometer at service (km)
            </Text>
            <TextInput
              value={odometer}
              onChangeText={setOdometer}
              placeholder="e.g., 75,000"
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
              style={styles.input}
            />

            {/* Interval */}
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
              Service interval (km)
            </Text>
            <TextInput
              value={intervalKm}
              onChangeText={setIntervalKm}
              placeholder={
                rec.defaultKm
                  ? rec.defaultKm.toLocaleString()
                  : 'e.g., 10,000'
              }
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
              style={styles.input}
            />

            <Text style={styles.helperOk}>Enter valid odometer & interval</Text>
            <Text style={[styles.helperMuted, { marginTop: 8 }]}>
              or enter your average monthly mileage (optional)
            </Text>
            <TextInput
              value={avgMonthly}
              onChangeText={setAvgMonthly}
              placeholder="e.g., 1,200 (km/month)"
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
              style={styles.input}
            />
          </>
        )}

        {/* Save */}
        <Pressable
          onPress={handleSave}
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
        >
          <Text style={styles.saveText}>
            {saving ? 'Saving…' : 'Save Service'}
          </Text>
        </Pressable>

        {/* Preview */}
        <Text style={styles.previewTitle}>Next Due (preview)</Text>
        <View style={styles.previewCard}>
          <Text style={styles.previewLine}>
            {isBattery
              ? `• Next replacement: ${preview}`
              : `• Due at:   ${preview}`}
          </Text>
          <Text style={styles.previewLine}>
            • Reminder: Push (email later)
          </Text>
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <View style={[styles.bottomBar, { paddingBottom: 10 + insets.bottom }]}>
        <NavBtn label="Home" icon="home" onPress={() => router.replace('/garage')} />
        <NavBtn label="Services" icon="construct" active onPress={() => {}} />
        <NavBtn
          label="Reminders"
          icon="notifications"
          onPress={() => router.replace('/reminders')}
        />
        <NavBtn
          label="Service History"
          icon="time"
          onPress={() => router.replace('/history')}
        />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: {
    flex: 1,
    color: TEXT,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: { color: MUTED, textAlign: 'center', marginBottom: 8 },

  fieldLabel: { color: TEXT, fontWeight: '800', marginBottom: 6 },
  dateInput: {
    height: 56,
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: { color: TEXT, fontWeight: '800' },
  placeholder: { color: MUTED, fontWeight: '800' },

  input: {
    height: 56,
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    color: TEXT,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },

  helperOk: { color: '#7BE495', fontWeight: '700', marginTop: 6 },
  helperMuted: { color: MUTED },

  saveBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  saveText: { color: '#0A0D12', fontWeight: '900', fontSize: 16 },

  previewTitle: { color: TEXT, fontWeight: '900', marginTop: 16, marginBottom: 8 },
  previewCard: {
    backgroundColor: CARD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  previewLine: { color: TEXT, marginBottom: 4 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: '#11141A',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  navBtn: { flex: 1, alignItems: 'center' },
  navText: { color: MUTED, fontSize: 11, fontWeight: '700' },
});
