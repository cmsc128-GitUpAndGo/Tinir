import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Notice } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useViewer } from '@/lib/viewer-provider';
import { access, type Area } from '@/services/access';
import type { Profile } from '@/services/contracts';

const AREA_COPY: Record<Area, { title: string; roles: string; purpose: string }> = {
  browse: { title: 'Browse', roles: 'everyone', purpose: 'browse listings' },
  account: { title: 'Account', roles: 'everyone', purpose: 'manage your account' },
  saved: { title: 'Saved listings', roles: 'students', purpose: 'save listings and compare them later' },
  inquiries: { title: 'Inquiries', roles: 'students and property owners', purpose: 'send and answer inquiries' },
  'my-listings': { title: 'My listings', roles: 'property owners', purpose: 'post and manage your listings' },
};

/**
 * Shows `children` only to viewers allowed into `area`. Typed URLs and deep links land here too, so a
 * guest is asked to log in and a wrong role is told the page is not for them. The backend still denies
 * the underlying requests on its own.
 */
export function RoleGate({ area, children }: { area: Area; children: (profile: Profile) => ReactNode }) {
  const { viewer, reload } = useViewer();
  const result = access(area, viewer);
  if (result.allowed && viewer.kind === 'member') return children(viewer.profile);

  const copy = AREA_COPY[area];
  const reason = result.allowed ? 'loading' : result.reason;
  return (
    <GateLayout title={copy.title}>
      {reason === 'loading' && <ActivityIndicator accessibilityLabel="Checking your account" />}
      {reason === 'login' && (
        <>
          <ThemedText themeColor="textSecondary">Log in or create an account to {copy.purpose}.</ThemedText>
          <Button label="Log in" onPress={() => router.push('/auth/login')} />
          <Button variant="secondary" label="Create an account" onPress={() => router.push('/auth/register')} />
        </>
      )}
      {reason === 'wrong-role' && (
        <>
          <Notice tone="info">This page is only for {copy.roles}.</Notice>
          <Button variant="secondary" label="Back to browsing" onPress={() => router.replace('/')} />
        </>
      )}
      {reason === 'unverified' && (
        <>
          <Notice tone="error">Verify your email to {copy.purpose}. You can keep browsing meanwhile.</Notice>
          <Button variant="secondary" label="Go to account" onPress={() => router.replace('/account')} />
        </>
      )}
      {reason === 'unknown' && viewer.kind === 'unknown' && (
        <>
          <Notice tone="error">{viewer.message}</Notice>
          <Button variant="secondary" label="Try again" onPress={reload} />
        </>
      )}
    </GateLayout>
  );
}

function GateLayout({ title, children }: { title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, {
        paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : insets.top + Spacing.four,
        paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
      }]}>
        <ThemedText type="subtitle" accessibilityRole="header">{title}</ThemedText>
        <View style={styles.section}>{children}</View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.three },
});
