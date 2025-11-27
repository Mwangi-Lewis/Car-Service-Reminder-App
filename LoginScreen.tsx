// src/screens/LoginScreen.tsx (or app/login.tsx if you route directly)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import Toast from 'react-native-toast-message';

import { auth } from '../lib/firebase'; // adjust path if your file lives elsewhere

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // If Register screen redirected here with ?created=1, show success toast once
  const { created } = useLocalSearchParams<{ created?: string }>();
  useEffect(() => {
    if (created === '1') {
      Toast.show({ type: 'success', text1: 'Account created successfully' });
    }
  }, [created]);

  const handleSignIn = async () => {
    if (!email || !password) {
      Toast.show({ type: 'error', text1: 'Enter email & password' });
      return;
    }
    try {
      setLoading(true);

      await signInWithEmailAndPassword(auth, email.trim(), password);
      Toast.show({ type: 'success', text1: 'Login successfully' });

      // Let your root router decide whether to go to /garage or /vehicle-register
      router.replace('/');
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Sign in failed',
        text2: String(e?.message || '')
          .replace(/^Firebase:\s*/i, '')
          .trim(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      Toast.show({ type: 'info', text1: 'Enter your email first' });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Toast.show({ type: 'success', text1: 'Password reset email sent' });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Reset failed',
        text2: String(e?.message || '')
          .replace(/^Firebase:\s*/i, '')
          .trim(),
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.appTitle}>Car Care App</Text>
          <Text style={styles.subtitle}>Login</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor="#9AA4B2"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9AA4B2"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable onPress={handleReset} style={styles.forgotWrap}>
            <Text style={styles.forgot}>Forgot password?</Text>
          </Pressable>

          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
              loading && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.primaryText}>{loading ? 'Signing in…' : 'Login'}</Text>
          </Pressable>

          <Text style={styles.footer}>
            Don’t have an account?{' '}
            <Link href="/register" style={styles.footerLink}>
              Sign up
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const CARD_BG = '#171A1F';
const PAGE_BG = '#0F1115';
const FIELD_BG = '#121418';
const BORDER = '#2A2F36';
const MUTED = '#9AA4B2';
const TEXT = '#E6E8EB';
const ACCENT = '#E65A50';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flexGrow: 1, padding: 20, justifyContent: 'center' },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    padding: 20,
    paddingTop: 28,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },

  appTitle: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: MUTED,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },

  label: {
    color: MUTED,
    fontSize: 13,
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

  forgotWrap: { alignSelf: 'flex-end', marginTop: 8 },
  forgot: { color: MUTED, fontSize: 13 },

  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 18 },

  footer: {
    color: MUTED,
    textAlign: 'center',
    marginTop: 18,
    fontSize: 13.5,
  },
  footerLink: { color: '#C6D3FF', fontWeight: '700' },
});
