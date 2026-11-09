import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/** Full-screen layout for auth routes, which render outside the tab bar. */
export function AuthScreen({ title, intro, back = { href: '/', label: 'Back to browsing' }, children }: {
  title: string; intro?: string; back?: { href: Href; label: string }; children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.five }]}>
        <Link href={back.href} style={styles.back} accessibilityRole="link">
          <ThemedText type="linkPrimary">‹ {back.label}</ThemedText>
        </Link>
        <View style={styles.header}>
          <ThemedText type="subtitle" accessibilityRole="header">{title}</ThemedText>
          {intro ? <ThemedText themeColor="textSecondary">{intro}</ThemedText> : null}
        </View>
        {children}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: Spacing.three, gap: Spacing.four },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  header: { gap: Spacing.two },
});
