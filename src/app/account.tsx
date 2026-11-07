import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Notice } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useResendVerification } from '@/hooks/use-resend-verification';
import { useViewer } from '@/lib/viewer-provider';
import { logout } from '@/services/auth';
import type { Profile } from '@/services/contracts';

export default function AccountScreen() {
  const { viewer, reload } = useViewer();
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, {
        paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : insets.top + Spacing.four,
        paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
      }]}>
        <ThemedText type="subtitle" accessibilityRole="header">Account</ThemedText>
        {viewer.kind === 'loading' ? <ActivityIndicator accessibilityLabel="Loading account" />
          : viewer.kind === 'guest' ? <SignedOut />
          : viewer.kind === 'unknown' ? <ProfileError message={viewer.message} onRetry={reload} />
          : <SignedIn current={viewer.profile} />}
      </ScrollView>
    </ThemedView>
  );
}

function SignedOut() {
  return (
    <View style={styles.section}>
      <ThemedText themeColor="textSecondary">
        You’re browsing as a guest. Create an account to send inquiries as a student or post listings as a property owner.
      </ThemedText>
      <Button label="Log in" onPress={() => router.push('/auth/login')} />
      <Button variant="secondary" label="Create an account" onPress={() => router.push('/auth/register')} />
      <Button variant="secondary" label="Resend verification email" onPress={() => router.push('/auth/resend')} />
    </View>
  );
}

async function signOut(setLeaving: (busy: boolean) => void) {
  setLeaving(true);
  // Logout removes the local session before contacting Auth, so a failed revocation still signs this device out.
  try { await logout(); } catch { /* Nothing to show: the account screen already returns to the guest view. */ } finally { setLeaving(false); }
}

function ProfileError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const [leaving, setLeaving] = useState(false);
  return (
    <View style={styles.section}>
      <Notice tone="error">{message}</Notice>
      <Button variant="secondary" label="Try again" onPress={onRetry} />
      <Button variant="secondary" label="Log out" busy={leaving} onPress={() => signOut(setLeaving)} />
    </View>
  );
}

function SignedIn({ current }: { current: Profile }) {
  const [leaving, setLeaving] = useState(false);
  const { resend, busy, remaining, result } = useResendVerification();

  return (
    <View style={styles.section}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary">{current.role === 'owner' ? 'PROPERTY OWNER' : 'STUDENT'}</ThemedText>
        <ThemedText style={styles.name}>{current.full_name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{current.email}</ThemedText>
        {current.contact_number ? <ThemedText type="small" themeColor="textSecondary">{current.contact_number}</ThemedText> : null}
        {current.college_program ? <ThemedText type="small" themeColor="textSecondary">{current.college_program}</ThemedText> : null}
      </ThemedView>
      {current.email_verified ? (
        <Notice tone="success">Your email is verified.</Notice>
      ) : (
        <>
          <Notice tone="error">
            Verify your email to send inquiries, save listings, or post listings. You can keep browsing meanwhile.
          </Notice>
          {result && <Notice tone={result.tone}>{result.message}</Notice>}
          <Button variant="secondary" label={remaining > 0 ? `Resend in ${remaining}s` : 'Resend verification email'}
            busy={busy} disabled={remaining > 0} onPress={() => resend(current.email)} />
        </>
      )}
      <Button variant="secondary" label="Log out" busy={leaving} onPress={() => signOut(setLeaving)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  name: { fontSize: 20, lineHeight: 28, fontWeight: 600 },
});
