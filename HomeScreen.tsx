import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Platform,
  Modal,
  TouchableOpacity,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

type FuelType =
  | 'Petrol'
  | 'Diesel'
  | 'Hybrid'
  | 'Electric';

type ServiceKey =
  | 'engineOil'
  | 'gearboxOil'
  | 'tires'
  | 'battery'
  | 'shocks'
  | 'brakePad'
  | 'wheelAlignment'
  | 'coolant'
  | 'sparkPlugs'
  | 'timingBelt'
  | 'airFilter'
  | 'wheelBearing';

type ServiceState = {
  lastDate?: Date | null;
  odoAtService?: string;
  intervalKm?: string;
  monthlyMileage?: string; // kept for future logic
};

const BRANDS = [
  // TODO: replace the placeholder image with your logo files
  { key: 'toyota', label: 'Toyota', img: require('../../assets/images/react-logo.png') },
  { key: 'vw', label: 'Volkswagen', img: require('../../assets/images/react-logo.png') },
  { key: 'volvo', label: 'Volvo', img: require('../../assets/images/react-logo.png') },
  { key: 'landrover', label: 'Land Rover', img: require('../../assets/images/react-logo.png') },
  { key: 'subaru', label: 'Subaru', img: require('../../assets/images/react-logo.png') },
];


const CARD_BG = '#f7eefc';
const INPUT_BG = '#f3f4f6';
const ACCENT = '#2563eb';
const HINT = '#16a34a';
const BORDER = '#d1d5db';
const TEXT_DARK = '#101010';
const TEXT_MUTED = '#666';

const fuelChips: FuelType[] = ['Petrol', 'Diesel', 'Hybrid', 'Electric'];

export default function HomeScreen() {
  // Car info
  const [brand, setBrand] = useState<string>('toyota');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [odometer, setOdometer] = useState('');
  const [monthlyMileage, setMonthlyMileage] = useState('');
  const [fuel, setFuel] = useState<FuelType>('Petrol');

  // Services state (all keys)
  const [services, setServices] = useState<Record<ServiceKey, ServiceState>>({
    engineOil: {},
    gearboxOil: {},
    tires: {},
    battery: {},
    shocks: {},
    brakePad: {},
    wheelAlignment: {},
    coolant: {},
    sparkPlugs: {},
    timingBelt: {},
    airFilter: {},
    wheelBearing: {},
  });

  // One date picker controller
  const [activePicker, setActivePicker] = useState<{
    key: ServiceKey | null;
    open: boolean;
  }>({ key: null, open: false });

  const openPicker = (key: ServiceKey) => setActivePicker({ key, open: true });
  const closePicker = () => setActivePicker({ key: null, open: false });

  const onPickDate = (key: ServiceKey, e: DateTimePickerEvent, date?: Date) => {
    if (e.type === 'dismissed') return;
    const picked = date ?? new Date();
    setServices((prev) => ({
      ...prev,
      [key]: { ...prev[key], lastDate: picked },
    }));
    if (Platform.OS !== 'ios') closePicker();
  };

  const setField = (key: ServiceKey, field: keyof ServiceState, value: string) => {
    setServices((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const fmtDate = (d?: Date | null) => (d ? d.toLocaleDateString() : 'Select Date');

  // All service card metadata (title + small gray line)
  const serviceMeta: Record<ServiceKey, { title: string; note: string; showIntervals: boolean }> = {
    engineOil: { title: 'Engine Oil', note: 'Change every 10,000 km', showIntervals: true },
    gearboxOil: { title: 'Gearbox Oil', note: 'Change every 50,000 km', showIntervals: true },
    tires: { title: 'Tires', note: 'Town: 50k–80k km, Off-road: 40k–50k km', showIntervals: true },
    battery: { title: 'Battery Replacement', note: 'Enter last battery change date', showIntervals: false },

    shocks: { title: 'Shocks/Springs', note: 'Town: 50k–60k km, Off-road: 30k–40k km', showIntervals: true },
    brakePad: { title: 'Brake Pad', note: 'Replace every 30,000 – 70,000 km', showIntervals: true },
    wheelAlignment: { title: 'Wheel Alignment', note: 'Check every 10,000 km', showIntervals: true },
    coolant: { title: 'Coolant', note: 'Replace every 60,000 km', showIntervals: true },
    sparkPlugs: { title: 'Spark Plugs', note: 'Replace every 30,000 – 90,000 km', showIntervals: true },
    timingBelt: { title: 'Timing Belt/Chain', note: 'Inspect/replace every 100,000 – 160,000 km', showIntervals: true },
    airFilter: { title: 'Air Filter', note: 'Replace every 15,000 – 30,000 km', showIntervals: true },
    wheelBearing: { title: 'Wheel Bearing', note: 'Inspect every 50,000 – 80,000 km', showIntervals: true },
  };

  // Render helper for any service
  const renderServiceCard = (key: ServiceKey) => {
    const state = services[key];
    const { title, note, showIntervals } = serviceMeta[key];

    return (
      <View
        key={key}
        style={{
          borderRadius: 14,
          backgroundColor: CARD_BG,
          padding: 16,
          marginTop: 18,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 6,
          borderWidth: 1,
          borderColor: '#eee',
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '700', color: TEXT_DARK }}>{title}</Text>
        <Text style={{ color: TEXT_MUTED, marginTop: 4 }}>{note}</Text>

        {/* Select date */}
        <Pressable
          onPress={() => openPicker(key)}
          style={{
            marginTop: 14,
            backgroundColor: INPUT_BG,
            borderRadius: 10,
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: BORDER,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 18, color: TEXT_DARK }}>{fmtDate(state.lastDate)}</Text>
        </Pressable>

        {/* Odometer & interval inputs when applicable */}
        {showIntervals && (
          <>
            <TextInput
              placeholder="Odometer at service"
              keyboardType="numeric"
              value={state.odoAtService ?? ''}
              onChangeText={(t) => setField(key, 'odoAtService', t)}
              style={styles.input}
              placeholderTextColor={TEXT_MUTED}
            />
            <TextInput
              placeholder="Service interval (km)"
              keyboardType="numeric"
              value={state.intervalKm ?? ''}
              onChangeText={(t) => setField(key, 'intervalKm', t)}
              style={styles.input}
              placeholderTextColor={TEXT_MUTED}
            />
            <Text style={{ color: HINT, marginTop: 6 }}>Enter valid odometer &amp; interval</Text>
            <Text style={{ color: TEXT_MUTED, marginTop: 8 }}>or by Enter monthly mileage</Text>
          </>
        )}
      </View>
    );
  };

  // iOS modal with inline picker
  const iOSPicker = useMemo(() => {
    if (Platform.OS !== 'ios' || !activePicker.open || !activePicker.key) return null;
    return (
      <Modal transparent animationType="fade" visible onRequestClose={closePicker}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <DateTimePicker
              mode="date"
              display="inline"
              value={services[activePicker.key].lastDate ?? new Date()}
              onChange={(e, d) => onPickDate(activePicker.key!, e, d)}
              maximumDate={new Date()}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={closePicker} style={styles.modalBtnGhost}>
                <Text style={{ color: TEXT_DARK, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closePicker} style={styles.modalBtn}>
                <Text style={{ color: 'white', fontWeight: '700' }}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }, [activePicker, services]);

  // Order all cards as in your screenshots
  const serviceOrder: ServiceKey[] = [
    'engineOil',
    'gearboxOil',
    'tires',
    'battery',
    'shocks',
    'brakePad',
    'wheelAlignment',
    'coolant',
    'sparkPlugs',
    'timingBelt',
    'airFilter',
    'wheelBearing',
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 48 }} style={{ flex: 1, backgroundColor: '#faf7ff' }}>
      {/* Header */}
      <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 12 }}>
        <Text style={{ fontSize: 54, marginBottom: 4 }}>🔧</Text>
        <Text style={{ fontSize: 26, fontWeight: '800', color: TEXT_DARK }}>
          Car Service Reminder
        </Text>
      </View>

      {/* Car Info */}
      <Text style={styles.sectionTitle}>🛠️ Car Info</Text>

      {/* Brands row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
        {BRANDS.map((b) => {
          const selected = brand === b.key;
          return (
            <Pressable
              key={b.key}
              onPress={() => setBrand(b.key)}
              style={{ alignItems: 'center', marginRight: 18, opacity: selected ? 1 : 0.6 }}
            >
              <View
                style={{
                  height: 56,
                  width: 56,
                  borderRadius: 28,
                  backgroundColor: 'white',
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? ACCENT : BORDER,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Image source={b.img} resizeMode="contain" style={{ height: 36, width: 36 }} />
              </View>
              <Text style={{ marginTop: 6, color: TEXT_MUTED }}>{b.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Car fields */}
      <TextInput
        value={model}
        onChangeText={setModel}
        placeholder="Car Model (e.g., Corolla)"
        style={styles.input}
        placeholderTextColor={TEXT_MUTED}
      />
      <TextInput
        value={year}
        onChangeText={setYear}
        placeholder="Year of Manufacture"
        keyboardType="numeric"
        style={styles.input}
        placeholderTextColor={TEXT_MUTED}
      />
      <TextInput
        value={odometer}
        onChangeText={setOdometer}
        placeholder="Current Odometer (e.g., 75,000 km)"
        keyboardType="numeric"
        style={styles.input}
        placeholderTextColor={TEXT_MUTED}
      />
      <TextInput
        value={monthlyMileage}
        onChangeText={setMonthlyMileage}
        placeholder="Average Monthly Mileage"
        keyboardType="numeric"
        style={styles.input}
        placeholderTextColor={TEXT_MUTED}
      />

      {/* Fuel chips */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, marginBottom: 8 }}>
        {fuelChips.map((f) => {
          const selected = f === fuel;
          return (
            <Pressable
              key={f}
              onPress={() => setFuel(f)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: 28,
                backgroundColor: selected ? ACCENT : '#e5e7eb',
              }}
            >
              <Text style={{ color: selected ? 'white' : TEXT_DARK, fontWeight: '700' }}>{f}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Service History */}
      <Text style={styles.sectionTitle}>🧰 Service History</Text>
      {serviceOrder.map((key) => renderServiceCard(key))}

      {/* iOS picker modal */}
      {iOSPicker}

      {/* Android calendar (inline) */}
      {Platform.OS === 'android' && activePicker.open && activePicker.key && (
        <DateTimePicker
          mode="date"
          display="calendar"
          value={services[activePicker.key].lastDate ?? new Date()}
          onChange={(e, d) => onPickDate(activePicker.key!, e, d)}
          maximumDate={new Date()}
        />
      )}
    </ScrollView>
  );
}

const styles = {
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 12,
    color: TEXT_DARK,
  } as const,
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_DARK,
    marginTop: 12,
  } as const,
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  } as const,
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  } as const,
  modalBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  } as const,
  modalBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  } as const,
};
