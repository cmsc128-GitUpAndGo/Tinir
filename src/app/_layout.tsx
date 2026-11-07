import { DarkTheme, DefaultTheme, Slot, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, Platform, StyleSheet, useColorScheme } from 'react-native';

import { SessionProvider } from '@/lib/supabase/session-provider';
import { useViewer, ViewerProvider } from '@/lib/viewer-provider';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ThemedView } from '@/components/themed-view';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <SessionProvider>
      <ViewerProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <Shell />
        </ThemeProvider>
      </ViewerProvider>
    </SessionProvider>
  );
}

function Shell() {
  const segments = useSegments();
  const { viewer } = useViewer();
  if (segments[0] === 'auth') return <Slot />;
  // Native tabs cannot open a hidden tab, so wait for the role before building them; otherwise a deep
  // link to a role screen would be dropped while the profile loads.
  if (Platform.OS !== 'web' && viewer.kind === 'loading') {
    return <ThemedView style={styles.loading}><ActivityIndicator accessibilityLabel="Loading your account" /></ThemedView>;
  }
  return <AppTabs />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
