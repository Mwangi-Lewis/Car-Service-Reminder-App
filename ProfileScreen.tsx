import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { auth, db, storage } from '@/src/lib/firebase';
import {
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

/* THEME (kept consistent with your app) */
const PAGE_BG = '#0F1115';
const CARD_BG = '#12151C';
const PANEL_BG = '#171A1F';
const BORDER   = '#2A2F36';
const TEXT     = '#E6E8EB';
const MUTED    = '#9AA4B2';
const ACTIVE   = '#C6D3FF';
const OK       = '#7BE495';
const DANGER   = '#E65A50';

/* --- types --- */
type SettingsDoc = {
  pushOn?: boolean;
  emailOn?: boolean;
  distanceUnit?: 'km' | 'mi';
};

type Vehicle = {
  id: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  regNo?: string;
  odometer?: number;
  fuel?: string;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<SettingsDoc>({
    pushOn: true,
    emailOn: false,
    distanceUnit: 'km',
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // local profile state (so UI updates immediately after edit)
  const [profileName, setProfileName] = useState(user?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.photoURL || '');

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profileName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const email = user?.email || '';

  const initials = useMemo(() => {
    const name = profileName;
    if (name?.trim()) {
      const parts = name.trim().split(/\s+/);
      return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
    }
    return (email?.[0] || 'U').toUpperCase();
  }, [profileName, email]);

  useEffect(() => {
    if (!user) return;
    setProfileName(user.displayName || '');
    setAvatarUrl(user.photoURL || '');
  }, [user]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoading(true);
      try {
        // settings
        const sref = doc(db, 'users', user.uid, 'profile', 'settings');
        const snap = await getDoc(sref);
        if (snap.exists()) {
          const data = snap.data() as SettingsDoc;
          setSettings({
            pushOn: data.pushOn ?? true,
            emailOn: data.emailOn ?? false,
            distanceUnit: (data.distanceUnit as 'km' | 'mi') ?? 'km',
          });
        } else {
          // initialize defaults
          await setDoc(sref, { pushOn: true, emailOn: false, distanceUnit: 'km' });
        }

        // vehicles
        const qv = query(
          collection(db, 'users', user.uid, 'vehicles'),
          orderBy('createdAt', 'desc'),
        );
        const vsnap = await getDocs(qv);
        const list: Vehicle[] = [];
        vsnap.forEach(d => {
          const v = d.data() || {};
          list.push({
            id: d.id,
            manufacturer: v.manufacturer,
            model: v.model,
            year: v.year,
            regNo: v.regNo,
            odometer: v.odometer,
            fuel: v.fuel,
          });
        });
        setVehicles(list);
      } catch (e: any) {
        console.error(e);
        Toast.show({ type: 'error', text1: 'Failed to load profile' });
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const toggleSetting = async (key: keyof SettingsDoc, value: any) => {
    if (!user) return;
    try {
      const sref = doc(db, 'users', user.uid, 'profile', 'settings');
      await updateDoc(sref, { [key]: value });
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to update setting' });
    }
  };

  /* ---------- Profile name editing ---------- */
  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Toast.show({ type: 'info', text1: 'Name cannot be empty' });
      return;
    }
    try {
      setSavingProfile(true);
      await updateProfile(user, { displayName: trimmed });
      setProfileName(trimmed);
      setEditingName(false);
      Toast.show({ type: 'success', text1: 'Name updated' });
    } catch (e: any) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Failed to update name' });
    } finally {
      setSavingProfile(false);
    }
  };

  /* ---------- Avatar upload ---------- */
  const pickAndUploadAvatar = async () => {
    if (!user) {
      Toast.show({ type: 'error', text1: 'Not signed in' });
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'info',
        text1: 'Permission needed to access gallery',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    try {
      setUploadingAvatar(true);
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();

      const storageRef = ref(storage, `users/${user.uid}/profile/avatar.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      await updateProfile(user, { photoURL: url });
      setAvatarUrl(url);

      Toast.show({ type: 'success', text1: 'Profile photo updated' });
    } catch (e: any) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Failed to update photo' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onChangePassword = async () => {
    if (!user?.email) {
      Toast.show({ type: 'info', text1: 'No email on file.' });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      Toast.show({ type: 'success', text1: 'Password reset email sent' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not send reset email' });
    }
  };

  const onSignOut = async () => {
    try {
      await signOut(auth);
      Toast.show({ type: 'success', text1: 'Signed out' });
      router.replace('/login');
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Sign out failed' });
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ACTIVE} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 + insets.bottom }}
        >
          {/* Top panel */}
          <View style={styles.topPanel}>
            {/* Avatar (tap to change) */}
            <Pressable onPress={pickAndUploadAvatar} style={styles.avatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
              <View style={styles.avatarCamera}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={16} color="#fff" />
                )}
              </View>
            </Pressable>

            {/* Name + email */}
            {editingName ? (
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Your name"
                placeholderTextColor={MUTED}
                style={styles.nameInput}
              />
            ) : (
              <Text style={styles.name}>
                {profileName || 'Set your name'}
              </Text>
            )}
            {!!email && <Text style={styles.email}>{email}</Text>}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() =>
                  editingName ? handleSaveName() : (setNameInput(profileName), setEditingName(true))
                }
                style={[
                  styles.editBtn,
                  savingProfile && { opacity: 0.7 },
                ]}
                disabled={savingProfile}
              >
                <Text style={{ color: '#C9D1E5', fontWeight: '800' }}>
                  {editingName ? 'Save' : 'Edit'}
                </Text>
              </Pressable>
              {editingName && (
                <Pressable
                  onPress={() => {
                    setEditingName(false);
                    setNameInput(profileName);
                  }}
                  style={[styles.editBtn, { backgroundColor: '#2A1F1F', borderColor: '#543636' }]}
                >
                  <Text style={{ color: '#E8C2C2', fontWeight: '800' }}>Cancel</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Vehicles */}
          <Text style={styles.sectionTitle}>My Vehicles</Text>
          <View style={styles.vehiclesCard}>
            {vehicles.length === 0 ? (
              <Text style={{ color: MUTED, fontStyle: 'italic' }}>No vehicles yet.</Text>
            ) : (
              vehicles.map(v => (
                <Pressable
                  key={v.id}
                  onPress={() =>
                    router.push({ pathname: '/vehicle/[id]', params: { id: v.id } })
                  }
                  style={styles.vehicleRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vehicleTitle}>
                      • {v.manufacturer} {v.model} {v.year ? v.year : ''}
                    </Text>
                    <Text style={styles.vehicleSub}>
                      {v.regNo ? `REG: ${v.regNo}` : ''}
                      {v.odometer
                        ? ` • ODO: ${v.odometer.toLocaleString()} ${settings.distanceUnit}`
                        : ''}
                      {v.fuel ? ` • ${v.fuel}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={MUTED} />
                </Pressable>
              ))
            )}

            <Pressable
              onPress={() => router.push('/vehicle-register')}
              style={styles.addVehicleBtn}
            >
              <Text style={{ color: '#0A0D12', fontWeight: '900' }}>Add Vehicle</Text>
            </Pressable>
          </View>

          {/* Preferences */}
          <Text style={styles.sectionTitle}>Preferences</Text>

          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Push notifications</Text>
            <Toggle
              value={!!settings.pushOn}
              onToggle={v => toggleSetting('pushOn', v)}
            />
          </View>

          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Email notifications</Text>
            <Toggle
              value={!!settings.emailOn}
              onToggle={v => toggleSetting('emailOn', v)}
            />
          </View>

          {/* Units */}
          <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Distance units</Text>
          <View style={styles.segmentWrap}>
            <Pressable
              onPress={() => toggleSetting('distanceUnit', 'km')}
              style={[
                styles.segment,
                settings.distanceUnit === 'km' && styles.segmentActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  settings.distanceUnit === 'km' && {
                    color: '#0A0D12',
                    fontWeight: '900',
                  },
                ]}
              >
                km
              </Text>
            </Pressable>
            <Pressable
              onPress={() => toggleSetting('distanceUnit', 'mi')}
              style={[
                styles.segment,
                settings.distanceUnit === 'mi' && styles.segmentActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  settings.distanceUnit === 'mi' && {
                    color: '#0A0D12',
                    fontWeight: '900',
                  },
                ]}
              >
                mi
              </Text>
            </Pressable>
          </View>

          {/* Reminder defaults */}
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
            Reminder defaults
          </Text>
          <View style={styles.reminderCard}>
            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              <Text style={styles.remKey}>Lead time</Text>
              <Text style={styles.remVal}>
                500 {settings.distanceUnit} or 30 days
              </Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.remKey}>Channels</Text>
              <Text style={styles.remVal}>
                {settings.pushOn ? 'Push' : ''}
                {settings.pushOn && settings.emailOn ? ' + ' : ''}
                {settings.emailOn ? 'Email' : !settings.pushOn ? '—' : ''}
              </Text>
            </View>
          </View>

          {/* Account */}
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Account</Text>
          <Pressable onPress={onChangePassword} style={styles.accountRow}>
            <Text style={{ color: TEXT, fontWeight: '800' }}>Change password</Text>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </Pressable>

          <Pressable onPress={onSignOut} style={styles.signOutBtn}>
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>
              Sign Out
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Bottom nav */}
      <View style={[styles.bottomBar, { paddingBottom: 10 + insets.bottom }]}>
        <NavBtn label="Home" icon="home" onPress={() => router.replace('/garage')} />
        <NavBtn
          label="Services"
          icon="construct"
          onPress={() => router.replace('/services')}
        />
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

/* ---------- Small components ---------- */

function Toggle({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onToggle(!value)}
      style={[
        styles.toggle,
        value && { backgroundColor: '#1D2A1F', borderColor: '#2F7740' },
      ]}
    >
      <View
        style={[
          styles.dot,
          value && { backgroundColor: OK, marginLeft: 20 },
        ]}
      />
      <Text style={[styles.toggleText, value && { color: OK }]}>
        {value ? 'On' : 'Off'}
      </Text>
    </Pressable>
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

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  headerTitle: { color: TEXT, fontSize: 24, fontWeight: '900' },

  topPanel: {
    backgroundColor: PANEL_BG,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#243042',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#1F2633',
    borderWidth: 2,
    borderColor: '#2B3750',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: ACTIVE,
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 1,
  },
  avatarCamera: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#00000099',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  name: { color: TEXT, fontSize: 20, fontWeight: '900' },
  nameInput: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#151925',
    minWidth: 200,
    textAlign: 'center',
  },
  email: { color: MUTED, marginTop: 4, marginBottom: 12, fontWeight: '700' },
  editBtn: {
    backgroundColor: '#2A3344',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#33425A',
  },

  sectionTitle: { color: TEXT, fontWeight: '900', marginTop: 10, marginBottom: 8 },

  vehiclesCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  vehicleTitle: { color: TEXT, fontWeight: '900' },
  vehicleSub: { color: MUTED, marginTop: 2 },
  addVehicleBtn: {
    backgroundColor: OK,
    marginTop: 10,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },

  prefRow: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefLabel: { color: TEXT, fontWeight: '800' },

  toggle: {
    width: 64,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#181C24',
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#666',
  },
  toggleText: { color: MUTED, marginLeft: 6, fontWeight: '800' },

  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 6,
    gap: 8,
  },
  segment: {
    flex: 1,
    backgroundColor: '#1A1F27',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1E2530',
  },
  segmentActive: { backgroundColor: OK, borderColor: OK },
  segmentText: { color: TEXT, fontWeight: '800' },

  reminderCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
  },
  remKey: { color: MUTED, width: 90, fontWeight: '700' },
  remVal: { color: TEXT, fontWeight: '800' },

  accountRow: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  signOutBtn: {
    backgroundColor: DANGER,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
  },

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
