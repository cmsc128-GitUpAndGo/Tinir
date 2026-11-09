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
import { LOGOUT_UNCONFIRMED } from '@/services/login';
import type { Profile } from '@/services/contracts';

export default function AccountScreen() {
  const { viewer, reload } = useViewer();
  const insets = useSafeAreaInsets();
  // Kept here, not in SignedIn, because logging out unmounts SignedIn before the warning can be read.
  // Each logout sets it afresh, so an earlier warning never outlives a later confirmed logout.
  const [logoutWarning, setLogoutWarning] = useState(false);
  const onLogout = (revoked: boolean) => setLogoutWarning(!revoked);
  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, {
        paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : insets.top + Spacing.four,
        paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
      }]}>
        <ThemedText type="subtitle" accessibilityRole="header">Account</ThemedText>
        {viewer.kind === 'loading' ? <ActivityIndicator accessibilityLabel="Loading account" />
          : viewer.kind === 'guest' ? <SignedOut logoutWarning={logoutWarning} />
          : viewer.kind === 'unknown' ? <ProfileError message={viewer.message} onRetry={reload} onLogout={onLogout} />
          : <SignedIn current={viewer.profile} onLogout={onLogout} />}
      </ScrollView>
    </ThemedView>
  );
}

function SignedOut({ logoutWarning }: { logoutWarning: boolean }) {
  return (
    <View style={styles.section}>
      {logoutWarning ? <Notice tone="error">{LOGOUT_UNCONFIRMED}</Notice> : null}
      <ThemedText themeColor="textSecondary">
        You’re browsing as a guest. Create an account to send inquiries as a student or post listings as a property owner.
      </ThemedText>
      <Button label="Log in" onPress={() => router.push('/auth/login')} />
      <Button variant="secondary" label="Create an account" onPress={() => router.push('/auth/register')} />
      <Button variant="secondary" label="Resend verification email" onPress={() => router.push('/auth/resend')} />
    </View>
  );
}

type OnLogout = (revoked: boolean) => void;

async function signOut(setLeaving: (busy: boolean) => void, onLogout: OnLogout) {
  setLeaving(true);
  // Logout removes the local session before contacting Auth, so a failed revocation still signs this device out,
  // but the user is told the server could not confirm it (NFR12).
  try {
    const { revoked } = await logout();
    onLogout(revoked);
  } catch {
    onLogout(false);
  } finally {
    setLeaving(false);
  }
}

function ProfileError({ message, onRetry, onLogout }: { message: string; onRetry: () => void; onLogout: OnLogout }) {
  const [leaving, setLeaving] = useState(false);
  return (
    <View style={styles.section}>
      <Notice tone="error">{message}</Notice>
      <Button variant="secondary" label="Try again" onPress={onRetry} />
      <Button variant="secondary" label="Log out" busy={leaving} onPress={() => signOut(setLeaving, onLogout)} />
    </View>
  );
}

function SignedIn({ current, onLogout }: { current: Profile; onLogout: OnLogout }) {
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
      <Button variant="secondary" label="Log out" busy={leaving} onPress={() => signOut(setLeaving, onLogout)} />
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
