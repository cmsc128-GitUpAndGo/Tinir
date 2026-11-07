import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Notice } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useResendVerification } from '@/hooks/use-resend-verification';
import { useSession } from '@/lib/supabase/session-provider';
import { logout } from '@/services/auth';
import { currentProfile } from '@/services/backend';
import type { Profile } from '@/services/contracts';
import { backendError } from '@/services/errors';

export default function AccountScreen() {
  const { session, loading } = useSession();
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, {
        paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : insets.top + Spacing.four,
        paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
      }]}>
        <ThemedText type="subtitle" accessibilityRole="header">Account</ThemedText>
        {loading ? <ActivityIndicator accessibilityLabel="Loading account" /> : session ? <SignedIn userId={session.user.id} /> : <SignedOut />}
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
      <Button label="Create an account" onPress={() => router.push('/auth/register')} />
      <Button variant="secondary" label="Resend verification email" onPress={() => router.push('/auth/resend')} />
    </View>
  );
}

function SignedIn({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<{ userId: string; value: Profile } | null>(null);
  const [failure, setFailure] = useState<{ userId: string; message: string } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const { resend, busy, remaining, result } = useResendVerification();

  useEffect(() => {
    let active = true;
    currentProfile()
      .then((value) => { if (active) setProfile({ userId, value }); })
      .catch((error) => { if (active) setFailure({ userId, message: backendError(error).error.message }); });
    return () => { active = false; };
  }, [userId]);

  const signOut = async () => {
    setLeaving(true);
    try { await logout(); } catch { /* The local session is cleared even if revocation fails. */ } finally { setLeaving(false); }
  };

  const current = profile?.userId === userId ? profile.value : null;
  const error = failure?.userId === userId ? failure.message : null;
  if (error) return <View style={styles.section}><Notice tone="error">{error}</Notice><Button variant="secondary" label="Log out" busy={leaving} onPress={signOut} /></View>;
  if (!current) return <ActivityIndicator accessibilityLabel="Loading profile" />;

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
      <Button variant="secondary" label="Log out" busy={leaving} onPress={signOut} />
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
