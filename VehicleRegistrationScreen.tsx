import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { db } from '../lib/firebase';
import { router } from 'expo-router';

/* -------------------- CAR DATA -------------------- */
/** Map manufacturer -> list of popular models (add more as you like) */
const CAR_DATA: Record<string, string[]> = {
  Toyota: ['4Runner', 'Aqua', 'Alphard', 'Allion', 'Auris', 'Avensis', 'Axio', 'C-HR', 'Camry', 'Corolla', 'Corolla Cross', 'Corolla Fielder', 'Crown', 'Crown Signia', 'Esquire', 'Estima', 'FJ Cruiser', 'Fortuner', 'GR86', 'GR Corolla', 'GR Supra', 'GR Yaris', 'Grand Highlander', 'Harrier', 'Hiace', 'Highlander/Kluger', 'Hilux', 'Innova', 'Isis', 'Land Cruiser V8', 'Land Cruiser Prado', 'Mark X', 'Mirai', 'Noah', 'Passo', 'Porte', 'Premio', 'Prius', 'Probox', 'Ractis', 'Raize', 'RAV4', 'Rush', 'Sienta', 'Starlet', 'Succeed', 'Tundra', 'Urban Cruiser', 'Vanguard', 'Vellfire', 'Vitz/Yaris', 'Voxy'],
  Honda: ['Accord', 'Brio', 'BR-V', 'City', 'Civic', 'CR-V', 'Elevate', 'Fit/Jazz/Life', 'Freed', 'HR-V/Vezel', 'N-Box', 'N-One', 'N-Van', 'N-WGN', 'Odyssey', 'Passport', 'Pilot', 'Prologue', 'Ridgeline', 'Stepwgn', 'WR-V', 'ZR-V'],
  Nissan: ['AD Van', 'Altima', 'Bluebird Sylphy', 'Caravan/NV350 Urvan', 'Cube', 'Dayz', 'Elgrand', 'Fuga', 'Hardbody/NP300', 'Juke', 'Kicks', 'Lafesta', 'Latio', 'Magnite', 'March/Micra', 'Murano', 'Navara', 'Note', 'NV200', 'Patrol', 'Qashqai/Dualis', 'Serena', 'Skyline', 'Sunny', 'Teana', 'Terra', 'Tiida', 'Wingroad', 'X-Trail'],
  Mazda: ['Atenza/Mazda6', 'Axela/Mazda3', 'Biante', 'Bongo', 'BT-50', 'CX-3', 'CX-5', 'CX-8', 'CX-9', 'CX-30', 'Demio/Mazda2', 'Familia', 'MPV', 'Premacy', 'Verisa'],
  Subaru: ['Forester', 'Outback', 'XV/Crosstrek', 'Impreza', 'Legacy', 'Levorg', 'Exiga', 'WRX', 'BRZ', 'Trezia'],
  Mitsubishi: ['Outlander', 'RVR/ASX', 'Pajero', 'Pajero Sport/Montero Sport', 'Mirage', 'L200/Triton', 'Eclipse Cross', 'Delica D5', 'Lancer', 'Colt', 'Galant Fortis'],
  Volkswagen: ['Golf', 'Tiguan', 'Polo', 'Passat', 'Touareg', 'Jetta', 'Amarok', 'Touran', 'Arteon', 'Sharan', 'Beetle', 'T-Cross'],
  BMW: ['3 Series', 'X5', 'X3', 'X1', '5 Series', 'X6', '7 Series', 'X4', '1 Series', '2 Series', 'X2', 'X7', 'i8', 'i4', 'M4', 'M3', 'M5'],
  Mercedes: ['A-Class', 'B-Class', 'C-Class', 'E-Class', 'S-Class', 'CLA', 'CLS', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'G-Class', 'AMG GT', 'V-Class', 'EQ Series'],
  Audi: ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'TT', 'R8', 'S/RS Models', 'E-Tron'],
  Ford: ['Ranger', 'Everest', 'Escape', 'Kuga', 'Focus', 'Fiesta', 'Mustang', 'Explorer', 'Transit', 'F-150'],
  Hyundai: ['Tucson', 'Santa Fe', 'Elantra', 'Sonata', 'Accent', 'Kona', 'Palisade', 'Creta', 'i10', 'i20', 'Grand Starex', 'Porter', 'Terracan', 'ix35'],
  Kia: ['Sportage', 'Sorento', 'Seltos', 'Sonet', 'Picanto', 'Rio', 'Cerato', 'Optima', 'K5', 'Soul', 'Carnival', 'K2700', 'Bongo'],
  Peugeot: ['308', '208', '3008', '508', '2008', '5008', '207', 'RCZ', '307', '504', 'Rifter', 'Landtrek'],
  Renault: ['Clio', 'Lutecia', 'Duster', 'Koleos', 'Captur', 'Megane', 'Fluence', 'Kwid', 'Kangoo', 'Kadjar', 'Twingo', 'Scenic'],
  LandRover: ['Range Rover Vogue', 'Range Rover Sport', 'Range Rover Evoque', 'Range Rover Velar', 'Defender', 'Discovery', 'Discovery Sport', 'Defender 110', 'Defender 130', 'Defender 90', 'Freelander'],
  Volvo: ['XC60', 'XC40', 'XC90', 'V40', 'S60', 'V60', 'V90', 'S90', 'C40', 'EM90', 'EX30', 'EX90', 'S60 Polestar', 'V60 Cross Country', 'V60 Polestar', 'V70', 'V90 Cross Country', 'C30', 'C70', 'S40', 'S80', 'V50', 'XC70', '240', '740', '240GL'],
  Suzuki: ['Swift', 'Jimny', 'Alto', 'Carry Truck', 'Escudo', 'Kei', 'Every', 'Alto Works', 'Baleno', 'Cara', 'Carry Van', 'Cervo', 'Cervo Mode', 'Cultus', 'Cultus Crescent', 'Cultus Crescent Wagon', 'D. DZIRE GLX', 'Every Wagon', 'Ertiga', 'Every Landy', 'Every Plus', 'Fronte', 'FRONX', 'Hustler', 'Ignis', 'Jimny Sierra', 'Jimny 1000', 'Jimny 1300', 'Jimny L', 'Jimny Nomade', 'Kizashi', 'Landy', 'Lapin', 'Migty Boy', 'MR Wagon', 'Palette', 'PaletteSW', 'Solio', 'Solio Bandit', 'Spacia', 'SX4 S-Cross', 'SX4 Sedan', 'S-PRESSO', 'Splash', 'Super Carry', 'SX4', 'Twin', 'Vitara', 'Wagon R', 'Wagon R Wide', 'X Bee', 'X-90'],
  Chevrolet: ['Cruze', 'Lacetti', 'Tahoe', 'Orlando', 'Colorado', 'Express', 'Silverado 1500', 'Aveo', 'Aveo5', 'Camaro Convertible', 'Camaro Coupe', 'Corvette Z06', 'Corvette Convertible', 'Corvette Coupe', 'Corvette ZR1', 'Corvette Grand Sport Coupe', 'Corvette Grand Sport Convertible', 'Equinox', 'HHR Wagon', 'HHR Panel', 'Impala', 'Malibu', 'Sonic Sedan', 'Malibu Hybrid', 'Sonic Hatchback', 'Suburban Half-Ton', 'Suburban Three-Quarter-Ton', 'Suburban', 'Traverse', 'Avalanche', 'Silverado 1500 Hybrid', 'Captiva', 'Trailblazer', 'Silverado', 'C-1500', 'Corvette C3', 'Silverado 2500', 'Corvette C8', 'C10', 'Corvette C1'],
  // Add as many as you need…
};

const MANUFACTURERS = Object.keys(CAR_DATA).sort();

/* ---------- Reusable searchable modal picker ---------- */
function SearchPickerModal({
  visible,
  title,
  items,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            style={styles.modalSearch}
            placeholder="Search…"
            placeholderTextColor={MUTED}
            value={query}
            onChangeText={setQuery}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            style={{ maxHeight: 360 }}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item);
                  setQuery('');
                }}
                style={styles.optionRow}
                activeOpacity={0.7}
              >
                <Text style={styles.optionText}>{item}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={[styles.optionText, { textAlign: 'center', opacity: 0.7, paddingVertical: 12 }]}>
                No results
              </Text>
            }
          />
          <Pressable onPress={onClose} style={styles.modalCloseBtn}>
            <Text style={styles.modalCloseText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------- Page -------------------- */
export default function VehicleRegisterPage() {
  const [vehicle, setVehicle] = useState('Car');

  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');

  const [regNo, setRegNo] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('');
  const [fuel, setFuel] = useState('');
  const [saving, setSaving] = useState(false);

  // modal visibility flags
  const [showMake, setShowMake] = useState(false);
  const [showModel, setShowModel] = useState(false);

  const modelOptions = useMemo(
    () => (manufacturer ? (CAR_DATA[manufacturer] ?? []) : []),
    [manufacturer]
  );

  const onSave = async () => {
    if (!manufacturer || !model || !regNo || !year || !mileage || !fuel) {
      Toast.show({ type: 'error', text1: 'Fill all fields' });
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Toast.show({ type: 'error', text1: 'Not signed in' });
      return;
    }

    try {
      setSaving(true);
      await addDoc(collection(db, 'users', user.uid, 'vehicles'), {
        vehicle,
        manufacturer,
        model,
        regNo,
        year: Number(year),
        currentMileageKm: Number(mileage),
        fuelType: fuel,
        createdAt: serverTimestamp(),
      });
      Toast.show({ type: 'success', text1: 'Vehicle registered' });
      router.replace('/garage');
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
    
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Vehicle registration</Text>
          
          {/* 🔙 Back Button */}
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

          {/* Vehicle type (free text, you can swap to a picker too) */}
          <Text style={styles.label}>Vehicle</Text>
          <TextInput
            style={styles.input}
            value={vehicle}
            onChangeText={setVehicle}
            placeholder="Car / SUV / Pickup"
            placeholderTextColor={MUTED}
          />

          {/* Manufacturer – searchable picker */}
          <Text style={styles.label}>Manufacturer</Text>
          <Pressable
            style={[styles.input, styles.inputButton]}
            onPress={() => setShowMake(true)}
            android_ripple={{ color: '#ffffff10' }}
          >
            <Text style={[styles.inputButtonText, !manufacturer && { color: MUTED }]}>
              {manufacturer || 'Select manufacturer'}
            </Text>
          </Pressable>

          {/* Model – searchable picker, depends on manufacturer */}
          <Text style={styles.label}>Model</Text>
          <Pressable
            style={[styles.input, styles.inputButton, !manufacturer && { opacity: 0.6 }]}
            onPress={() => manufacturer && setShowModel(true)}
            android_ripple={{ color: '#ffffff10' }}
          >
            <Text style={[styles.inputButtonText, !model && { color: MUTED }]}>
              {manufacturer
                ? model || 'Select model'
                : 'Select manufacturer first'}
            </Text>
          </Pressable>
          

          {/* Reg No */}
          <Text style={styles.label}>Reg. No.</Text>
          <TextInput
            style={styles.input}
            value={regNo}
            onChangeText={setRegNo}
            placeholder="KDA 123A"
            placeholderTextColor={MUTED}
            autoCapitalize="characters"
          />

          {/* Year */}
          <Text style={styles.label}>Year</Text>
          <TextInput
            style={styles.input}
            value={year}
            onChangeText={setYear}
            placeholder="2021"
            placeholderTextColor={MUTED}
            keyboardType="number-pad"
            maxLength={4}
          />

          {/* Mileage */}
          <Text style={styles.label}>Current Mileage(Km)</Text>
          <TextInput
            style={styles.input}
            value={mileage}
            onChangeText={setMileage}
            placeholder="10200"
            placeholderTextColor={MUTED}
            keyboardType="number-pad"
          />

          {/* Fuel Type */}
          <Text style={styles.label}>Fuel Type</Text>
          <TextInput
            style={styles.input}
            value={fuel}
            onChangeText={setFuel}
            placeholder="Petrol, Diesel, Hybrid or Electric"
            placeholderTextColor={MUTED}
          />

          <Pressable
            onPress={onSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.92 },
              saving && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'REGISTER'}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Manufacturer Modal */}
      <SearchPickerModal
        visible={showMake}
        title="Select manufacturer"
        items={MANUFACTURERS}
        onSelect={(val) => {
          setManufacturer(val);
          setModel('');            // reset model when brand changes
          setShowMake(false);
        }}
        onClose={() => setShowMake(false)}
      />

      {/* Model Modal */}
      <SearchPickerModal
        visible={showModel}
        title={manufacturer ? `Select model • ${manufacturer}` : 'Select model'}
        items={modelOptions}
        onSelect={(val) => {
          setModel(val);
          setShowModel(false);
        }}
        onClose={() => setShowModel(false)}
      />
    </KeyboardAvoidingView>
  );
}

/* -------------------- Styles -------------------- */
const PAGE_BG = '#0F1115';
const CARD_BG = '#171A1F';
const FIELD_BG = '#121418';
const BORDER = '#2A2F36';
const TEXT = '#E6E8EB';
const MUTED = '#9AA4B2';
const ACCENT = '#E65A50';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flexGrow: 1, padding: 16, paddingTop: 24, paddingBottom: 40 },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#62A3FF33',
  },
  title: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },
  label: {
    color: MUTED,
    fontSize: 13,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: FIELD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    color: TEXT,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  backButton: {
  alignSelf: 'flex-start',
  backgroundColor: '#1F242C',
  borderRadius: 10,
  paddingVertical: 8,
  paddingHorizontal: 14,
  marginBottom: 10,
  borderWidth: 1,
  borderColor: '#2A2F36',
},
backText: {
  color: '#E6E8EB',
  fontWeight: '700',
  fontSize: 15,
},

  /* Pressable “input” look */
  inputButton: {
    justifyContent: 'center',
  },
  inputButtonText: {
    color: TEXT,
    fontSize: 15,
  },

  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 26,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 17, letterSpacing: 0.3 },

  /* Modal styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#0009',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2F36',
  },
  modalTitle: {
    color: TEXT,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSearch: {
    backgroundColor: FIELD_BG,
    borderColor: BORDER,
    borderWidth: 1,
    color: TEXT,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  optionText: { color: TEXT, fontSize: 15 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },
  modalCloseBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCloseText: { color: MUTED, fontWeight: '700' },
});
