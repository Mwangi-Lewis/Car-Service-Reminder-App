import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import {
  addDoc, collection, deleteDoc, doc, getDocs, orderBy, query,
  serverTimestamp, Timestamp, updateDoc,
} from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';

// ✅ match the actual exported names from notification.ts
import {
  initNotifications,
  scheduleOneShot,
  cancelNotification,
  cancelAllScheduled,
} from '@/src/lib/notifications';

type Reminder = {
  id: string;
  title: string;               // e.g., Engine Oil
  vehicleName?: string;        // “Audi A5”
  vehicleId?: string;          // optional
  dueAt: Timestamp;            // next due date
  dueKm?: number;              // optional info
  status: 'pending' | 'done';  // “pending” covers upcoming/overdue
  scheduledId?: string | null; // local notification id
  createdAt?: Timestamp;
  completedAt?: Timestamp | null;
};

const PAGE_BG = '#0F1115';
const CARD_BG = '#171A1F';
const BORDER  = '#2A2F36';
const TEXT    = '#E6E8EB';
const MUTED   = '#9AA4B2';
const ACTIVE  = '#C6D3FF';
const OK      = '#7BE495';
const DANGER  = '#FF6B6B';

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
}
function daysUntil(d: Date) {
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifOn, setNotifOn] = useState(true);

  // modal state
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newVehicle, setNewVehicle] = useState('');
  const [newDays, setNewDays] = useState('7');
  const [newKm, setNewKm] = useState('');

  const uid = auth.currentUser?.uid;

  async function load() {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users', uid, 'reminders'), orderBy('dueAt', 'asc'));
      const snap = await getDocs(q);
      const rows: Reminder[] = [];
      snap.forEach(d => rows.push({ id: d.id, ...(d.data() as any) }));
      setList(rows);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Failed to load reminders', text2: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const ok = await initNotifications(); // channel + handler + permission
      setNotifOn(ok);
      await load();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const now = new Date();
  const upcoming = useMemo(
    () => list.filter(r => r.status === 'pending' && r.dueAt.toDate() >= now),
    [list]
  );
  const overdue  = useMemo(
    () => list.filter(r => r.status === 'pending' && r.dueAt.toDate() <  now),
    [list]
  );
  const done     = useMemo(
    () => list.filter(r => r.status === 'done'),
    [list]
  );

  async function markDone(r: Reminder) {
    if (!uid) return;
    await cancelNotification(r.scheduledId);
    const ref = doc(db, 'users', uid, 'reminders', r.id);
    await updateDoc(ref, { status: 'done', completedAt: serverTimestamp(), scheduledId: null });

    // Also write to global history (used by your History screen)
    await addDoc(collection(db, 'users', uid, 'history'), {
      title: r.title,
      vehicleName: r.vehicleName ?? null,
      completedAt: serverTimestamp(),
      note: `Reminder completed.${r.dueKm ? ` At ${r.dueKm.toLocaleString()} km.` : ''}`,
      type: 'reminder',
      originReminderId: r.id,
    });

    Toast.show({ type:'success', text1:'Marked done' });
    load();
  }

  async function snooze(r: Reminder, days = 7) {
    if (!uid) return;
    const newDate = new Date(r.dueAt.toDate().getTime() + days * 24*60*60*1000);

    await cancelNotification(r.scheduledId);
    const newSched = notifOn
      ? await scheduleOneShot({
          title: r.title,
          body: `Due ${fmt(newDate)}${r.vehicleName ? ` • ${r.vehicleName}` : ''}`,
          fireDate: newDate,
        })
      : null;

    const ref = doc(db, 'users', uid, 'reminders', r.id);
    await updateDoc(ref, { dueAt: Timestamp.fromDate(newDate), scheduledId: newSched });
    Toast.show({ type:'success', text1:`Snoozed ${days} day${days===1?'':'s'}` });
    load();
  }

  async function remove(r: Reminder) {
    if (!uid) return;
    await cancelNotification(r.scheduledId);
    await deleteDoc(doc(db, 'users', uid, 'reminders', r.id));
    Toast.show({ type:'success', text1:'Reminder deleted' });
    load();
  }

  async function createQuick() {
    if (!uid) return;
    if (!newTitle.trim()) {
      Toast.show({ type:'info', text1:'Enter a title' });
      return;
    }
    const days = Math.max(0, parseInt(newDays || '0', 10));
    const dueAt = new Date(Date.now() + days*24*60*60*1000);

    const scheduledId = notifOn
      ? await scheduleOneShot({
          title: newTitle.trim(),
          body: `Due ${fmt(dueAt)}${newVehicle ? ` • ${newVehicle}` : ''}`,
          fireDate: dueAt,
        })
      : null;

    await addDoc(collection(db, 'users', uid, 'reminders'), {
      title: newTitle.trim(),
      vehicleName: newVehicle.trim() || null,
      vehicleId: null,
      dueAt: Timestamp.fromDate(dueAt),
      dueKm: newKm ? Number(newKm.replace(/[^0-9]/g,'')) : null,
      status: 'pending',
      scheduledId,
      createdAt: serverTimestamp(),
      completedAt: null,
    });

    setShowNew(false);
    setNewTitle(''); setNewVehicle(''); setNewDays('7'); setNewKm('');
    Toast.show({ type:'success', text1:'Reminder added' });
    load();
  }

  return (
    <SafeAreaView style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Reminders</Text>
        <Pressable onPress={() => setShowNew(true)} style={styles.newBtn}>
          <Text style={{ color: OK, fontWeight:'800' }}>+ New</Text>
        </Pressable>
      </View>

      {/* Tabs summary */}
      <View style={styles.tabsRow}>
        <Pill label={`Upcoming (${upcoming.length})`} active />
        <Pill label={`Overdue (${overdue.length})`} />
        <Pill label={`Completed (${done.length})`} />
      </View>

      {/* Notifications toggle – re-asks permission if tapped */}
      <View style={styles.notifRow}>
        <Text style={{ color: MUTED, fontWeight:'700' }}>Notifications</Text>
        <Pressable
          onPress={async () => {
            const ok = await initNotifications();
            setNotifOn(ok);
            Toast.show({
              type: ok ? 'success' : 'info',
              text1: ok ? 'Notifications ON' : 'Notifications OFF',
            });
          }}
          style={[styles.toggle, notifOn && { backgroundColor: OK+'33', borderColor: OK }]}
        >
          <View style={[styles.dot, notifOn && { backgroundColor: OK, marginLeft: 18 }]} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}>
        {/* UPCOMING */}
        {upcoming.map(r => (
          <ReminderCard
            key={r.id}
            r={r}
            variant="upcoming"
            onDone={() => markDone(r)}
            onSnooze={() => snooze(r, 7)}
            onDelete={() => remove(r)}
          />
        ))}

        {/* OVERDUE */}
        {overdue.map(r => (
          <ReminderCard
            key={r.id}
            r={r}
            variant="overdue"
            onDone={() => markDone(r)}
            onSnooze={() => snooze(r, 3)}
            onDelete={() => remove(r)}
          />
        ))}

        {/* DONE */}
        {done.map(r => (
          <ReminderCard
            key={r.id}
            r={r}
            variant="done"
            onUndo={() =>
              updateDoc(doc(db,'users',uid!,'reminders',r.id), { status:'pending', completedAt:null })
                .then(load)
            }
          />
        ))}

        {!loading && list.length === 0 && (
          <Text style={{ color: MUTED, textAlign:'center', marginTop: 20 }}>
            No reminders yet.
          </Text>
        )}
      </ScrollView>

      {/* Bottom nav (same style as other screens) */}
      <View style={[styles.bottomBar, { paddingBottom: 10 + insets.bottom }]}>
        <NavBtn label="Home" icon="home" onPress={() => router.replace('/garage')} />
        <NavBtn label="Services" icon="construct" onPress={() => router.replace('/services')} />
        <NavBtn label="Reminders" icon="notifications" active onPress={() => {}} />
        <NavBtn label="Service History" icon="time" onPress={() => router.replace('/history')} />
      </View>

      {/* New Reminder Modal */}
      <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Reminder</Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Engine Oil"
              placeholderTextColor={MUTED}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Vehicle (optional)</Text>
            <TextInput
              value={newVehicle}
              onChangeText={setNewVehicle}
              placeholder="Audi A5"
              placeholderTextColor={MUTED}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Due in (days)</Text>
            <TextInput
              value={newDays}
              onChangeText={setNewDays}
              keyboardType="number-pad"
              placeholder="7"
              placeholderTextColor={MUTED}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Due at (km) — optional</Text>
            <TextInput
              value={newKm}
              onChangeText={setNewKm}
              keyboardType="number-pad"
              placeholder="85,000"
              placeholderTextColor={MUTED}
              style={styles.input}
            />

            <View style={{ flexDirection:'row', gap:10, marginTop:16 }}>
              <Pressable
                style={[styles.btn, { backgroundColor: '#2A2F36' }]}
                onPress={() => setShowNew(false)}
              >
                <Text style={{ color: TEXT, fontWeight:'800' }}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.btn, { backgroundColor: OK }]}
                onPress={createQuick}
              >
                <Text style={{ color: '#0A0D12', fontWeight:'900' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- Presentational bits ---------- */

function Pill({ label, active=false }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.pill, active && { backgroundColor: ACTIVE+'33', borderColor: ACTIVE }]}>
      <Text style={[styles.pillText, active && { color: ACTIVE }]}>{label}</Text>
    </View>
  );
}

function ReminderCard({
  r, variant, onDone, onSnooze, onDelete, onUndo,
}: {
  r: Reminder;
  variant: 'upcoming' | 'overdue' | 'done';
  onDone?: () => void;
  onSnooze?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
}) {
  const due = r.dueAt.toDate();
  const days = daysUntil(due);
  const badgeText =
    variant === 'done' ? 'DONE' :
    variant === 'overdue' ? 'OVERDUE' : 'UPCOMING';
  const badgeColor =
    variant === 'done' ? OK :
    variant === 'overdue' ? DANGER : ACTIVE;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex:1 }}>
          <Text style={styles.cardTitle}>{r.title}</Text>
          {!!r.vehicleName && <Text style={styles.cardSub}>{r.vehicleName}</Text>}
        </View>
        <View style={[styles.badge, { backgroundColor: badgeColor+'33', borderColor: badgeColor }]}>
          <Text style={{ color: badgeColor, fontWeight:'800' }}>{badgeText}</Text>
        </View>
      </View>

      <Text style={styles.cardInfo}>
        {variant === 'overdue'
          ? `${Math.abs(days)} day${Math.abs(days)===1?'':'s'} late`
          : `Due in ${days} day${days===1?'':'s'}`}
        {r.dueKm ? `   •   at ${r.dueKm.toLocaleString()} km` : ''}
      </Text>

      <View style={{ flexDirection:'row', gap:10, marginTop:10 }}>
        {variant !== 'done' ? (
          <>
            <Pressable style={[styles.smallBtn, { backgroundColor:'#2A2F36' }]} onPress={onSnooze}>
              <Text style={{ color: TEXT, fontWeight:'800' }}>Snooze</Text>
            </Pressable>
            <Pressable style={[styles.smallBtn, { backgroundColor: OK }]} onPress={onDone}>
              <Text style={{ color: '#0A0D12', fontWeight:'900' }}>Done</Text>
            </Pressable>
            <Pressable style={[styles.iconBtn]} onPress={onDelete}>
              <Ionicons name="trash" size={18} color={MUTED} />
            </Pressable>
          </>
        ) : (
          <Pressable style={[styles.smallBtn, { backgroundColor:'#2A2F36' }]} onPress={onUndo}>
            <Text style={{ color: TEXT, fontWeight:'800' }}>Undo</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:16, paddingBottom: 8,
  },
  backBtn: { padding:6, marginRight:8 },
  headerTitle: { flex:1, color: TEXT, fontSize: 24, fontWeight:'900', textAlign:'left' },
  newBtn: { padding: 6 },

  tabsRow: { flexDirection:'row', gap:10, paddingHorizontal:16, marginBottom:6 },
  pill: {
    backgroundColor: '#1C2230', borderWidth:1, borderColor:'#2B3340',
    paddingVertical:8, paddingHorizontal:12, borderRadius:20,
  },
  pillText: { color: TEXT, fontWeight:'800' },

  notifRow: {
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingHorizontal:16, marginBottom: 8,
  },
  toggle: {
    width:40, height:22, borderRadius:999, borderWidth:1, borderColor:'#2A2F36', justifyContent:'center',
    backgroundColor:'#171A1F',
  },
  dot: { width:16, height:16, borderRadius:8, backgroundColor:'#666', marginLeft:4 },

  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 16, padding: 14, marginBottom: 12,
  },
  cardHeader: { flexDirection:'row', alignItems:'center' },
  cardTitle: { color: TEXT, fontSize: 16, fontWeight:'900' },
  cardSub: { color: MUTED, marginTop: 2 },
  badge: { paddingHorizontal:10, paddingVertical:4, borderRadius: 12, borderWidth:1 },
  cardInfo: { color: MUTED, marginTop: 6 },

  smallBtn: { paddingVertical:10, paddingHorizontal:14, borderRadius:12 },
  iconBtn: { paddingHorizontal:12, justifyContent:'center', borderRadius:12, backgroundColor:'#2A2F36' },

  bottomBar: {
    position:'absolute', left:0, right:0, bottom:0,
    flexDirection:'row',
    borderTopWidth:1, borderTopColor:BORDER,
    backgroundColor:'#11141A',
    paddingVertical:10, paddingHorizontal:8,
  },
  navBtn: { flex:1, alignItems:'center' },
  navText: { color: MUTED, fontSize:11, fontWeight:'700' },

  // modal
  modalBackdrop: { flex:1, backgroundColor:'#0008', alignItems:'center', justifyContent:'flex-end' },
  modalCard: {
    backgroundColor: CARD_BG, borderTopLeftRadius:18, borderTopRightRadius:18,
    width:'100%', padding:16, borderTopWidth:1, borderColor:BORDER,
  },
  modalTitle: { color: TEXT, fontSize:18, fontWeight:'900', marginBottom:8 },
  label: { color: MUTED, marginTop: 4, marginBottom:6, fontWeight:'700' },
  input: {
    backgroundColor:'#121418', borderColor:BORDER, borderWidth:1, color:TEXT,
    borderRadius:12, paddingHorizontal:12, paddingVertical:10, fontSize:15,
  },
  btn: { flex:1, alignItems:'center', paddingVertical:12, borderRadius:12 },
});

/* Reuse the same bottom nav pattern as other screens */
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
