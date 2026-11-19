import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { completeVerification } from '@/services/auth';
import { returnPath } from '@/services/return-path';

/**
 * Email verification landing (FR3). When signup started from a listing, the validated `next` path comes back
 * in the link so the user can return to it (FR2); sending an inquiry stays a separate action there.
 */
export default function VerificationCallback() {
  const { code, error, next: nextParam } = useLocalSearchParams<{ code?: string; error?: string; next?: string }>();
  const next = returnPath(nextParam);
  const started = useRef(false);
  const [state, setState] = useState<'pending' | 'verified' | 'failed'>('pending');
  useEffect(() => {
    if (started.current || !code || error) return;
    started.current = true;
    const url = new URL('tinir://auth/callback'); url.searchParams.set('code', code);
    void completeVerification(url.toString()).then(() => setState('verified')).catch(() => setState('failed'));
  }, [code, error]);
  const message = !code || error ? 'This verification link is invalid or expired. Request a new email.'
    : state === 'verified' ? 'Your email is verified.'
    : state === 'failed' ? 'Verification failed. Open the latest link on the device where you registered, or request a new email.'
    : 'Verifying your email…';
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header">Email verification</Text>
      <Text accessibilityLiveRegion="polite">{message}</Text>
      {next && state === 'verified' ? <Link href={next} replace>Back to the listing</Link> : null}
      <Link href="/">Return to Tinir</Link>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 } });
