import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { completeVerification } from '@/services/auth';

export default function VerificationCallback() {
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const started = useRef(false);
  const [message, setMessage] = useState('Verifying your email…');
  useEffect(() => {
    if (started.current || !code || error) return;
    started.current = true;
    const url = new URL('tinir://auth/callback'); url.searchParams.set('code', code);
    void completeVerification(url.toString()).then(() => setMessage('Your email is verified.')).catch(() => setMessage('Verification failed. Open the latest link on the device where you registered, or request a new email.'));
  }, [code, error]);
  return <View style={styles.container}><Text accessibilityRole="header">Email verification</Text><Text accessibilityLiveRegion="polite">{!code || error ? 'This verification link is invalid or expired. Request a new email.' : message}</Text><Link href="/">Return to Tinir</Link></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 } });
