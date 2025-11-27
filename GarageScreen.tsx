import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { auth, db, storage } from '../lib/firebase';

type Car = {
  id: string;
  manufacturer: string;
  model: string;
  regNo: string;
  year?: number;
  photoUrl?: string;
};

const PAGE_BG = '#0F1115';
const CARD_BG = '#171A1F';
const FIELD_BG = '#121418';
const BORDER = '#2A2F36';
const TEXT = '#E6E8EB';
const MUTED = '#9AA4B2';
const ACCENT = '#E65A50';
const ACTIVE = '#C6D3FF';

export default function GarageScreen() {
  const [cars, setCars] = useState<Car[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const q = query(
        collection(db, 'users', user.uid, 'vehicles'),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      const list: Car[] = [];
      snap.forEach(d => {
        const v = d.data() || {};
        list.push({
          id: d.id,
          manufacturer: v.manufacturer ?? '',
          model: v.model ?? '',
          regNo: v.regNo ?? '',
          year: v.year,
          photoUrl: v.photoUrl,
        });
      });
      setCars(list);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load vehicles' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const pickAndUpload = async (carId: string) => {
    const user = auth.currentUser;
    if (!user) {
      Toast.show({ type: 'error', text1: 'Not signed in' });
      return;
    }

    const granted = await requestMediaPermission();
    if (!granted) {
      Toast.show({ type: 'info', text1: 'Permission required to access gallery' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.length) return;

    try {
      setUploadingFor(carId);
      const uri = result.assets[0].uri;
      const blob = await (await fetch(uri)).blob();

      const storageRef = ref(storage, `users/${user.uid}/vehicles/${carId}/photo.jpg`);
      await uploadBytes(storageRef, blob);

      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', user.uid, 'vehicles', carId), { photoUrl: url });

      setCars(prev => prev.map(c => (c.id === carId ? { ...c, photoUrl: url } : c)));
      Toast.show({ type: 'success', text1: 'Photo added' });
    } catch (e) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Upload failed' });
    } finally {
      setUploadingFor(null);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      Toast.show({ type: 'success', text1: 'Logged out successfully' });
      router.replace('/login');
    } catch (e) {
      console.error('Logout error:', e);
      Toast.show({ type: 'error', text1: 'Logout failed' });
    }
  };

  const user = auth.currentUser;
  const avatarUri = user?.photoURL || undefined;

  return (
    <SafeAreaView style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header with centered title + profile icon on the right */}
      <View style={styles.header}>
        <View style={{ width: 28 }} />
        <Text style={styles.headerTitle}>My Garage</Text>

        <Pressable
          style={styles.profileBtn}
          onPress={() => router.push('/profile')}
          android_ripple={{ color: '#ffffff10', borderless: true }}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="person-circle-outline" size={28} color={ACTIVE} />
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor="#fff"
          />
        }
      >
        <View style={styles.card}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>CarCare</Text>
          </View>

          {cars.map(c => (
            <View key={c.id} style={styles.carCard}>
              <Text style={styles.carTitle}>
                {c.manufacturer}{' '}
                <Text style={{ fontStyle: 'italic' }}>{c.model}</Text>
              </Text>
              <Text style={styles.carSub}>
                {c.regNo}
                {c.year ? ` • ${c.year}` : ''}
              </Text>

              {/* 👉 Tap image to open Vehicle Records */}
              {c.photoUrl ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/vehicle/[id]',
                      params: { id: String(c.id) },
                    })
                  }
                >
                  <Image
                    source={{ uri: c.photoUrl }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                </Pressable>
              ) : null}

              {/* Add/Change photo */}
              <Pressable
                style={styles.photoBox}
                onPress={() => pickAndUpload(c.id)}
                disabled={uploadingFor === c.id}
              >
                {uploadingFor === c.id ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color="#9AA4B2" />
                    <Text style={styles.photoText}>Uploading…</Text>
                  </View>
                ) : (
                  <Text style={styles.photoText}>
                    {c.photoUrl ? 'Change photo' : '+ Add your car photo'}
                  </Text>
                )}
              </Pressable>
            </View>
          ))}

          {/* Add another car */}
          <Pressable
            style={[styles.carCard, { borderStyle: 'solid', borderColor: BORDER, borderWidth: 1 }]}
            onPress={() => router.push('/vehicle-register')}
          >
            <View style={[styles.photoBox, { marginTop: 8, backgroundColor: FIELD_BG }]}>
              <Text style={styles.photoText}>+ Add another Car</Text>
            </View>
          </Pressable>

          {/* Logout */}
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  headerTitle: {
    flex: 1,
    color: TEXT,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  profileBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: BORDER },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 80 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    padding: 16,
    borderWidth: 1,
    borderColor: '#62A3FF33',
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    marginBottom: 12,
  },
  pillText: { color: '#fff', fontWeight: '800' },

  carCard: {
    backgroundColor: '#1B1F25',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  carTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  carSub: { color: MUTED, fontSize: 13, marginBottom: 12 },

  photoImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2F36',
  },
  photoBox: {
    backgroundColor: '#1F242C',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderWidth: 1,
    borderColor: '#2A2F36',
  },
  photoText: { color: MUTED, fontWeight: '700' },

  logoutButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
