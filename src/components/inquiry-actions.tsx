import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, Notice } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useViewer } from '@/lib/viewer-provider';
import { withReturnPath } from '@/services/return-path';

export type InquiryKind = 'interest' | 'question';

/**
 * The two inquiry entry points on a listing: "I'm interested" and "Ask a question" (FR2, FR7).
 * Guests get a log-in prompt that returns them to this listing without sending anything. Unverified
 * accounts and owners are told why they cannot send. The server rejects the same requests on its own.
 */
export function InquiryActions({ listingId }: { listingId: string }) {
  const { viewer, reload } = useViewer();
  const [blocked, setBlocked] = useState<InquiryKind | null>(null);
  const here = `/listing/${listingId}` as Href;

  if (viewer.kind === 'loading') return <Heading><ActivityIndicator accessibilityLabel="Checking your account" /></Heading>;
  if (viewer.kind === 'unknown') {
    return (
      <Heading>
        <Notice tone="error">{viewer.message}</Notice>
        <Button variant="secondary" label="Try again" onPress={reload} />
      </Heading>
    );
  }
  if (viewer.kind === 'member' && viewer.profile.role === 'owner') {
    return <Heading><Notice tone="info">Only student accounts can send inquiries. Owners answer them from the Inquiries tab.</Notice></Heading>;
  }
  // Sending as a verified student is FR7; this covers everyone who has to be stopped first.
  if (viewer.kind === 'member' && viewer.profile.email_verified) return null;

  const guest = viewer.kind === 'guest';
  if (blocked) {
    return (
      <Heading>
        {guest ? (
          <>
            <Notice tone="info">
              <ThemedText type="smallBold">Log in to contact the owner</ThemedText>
              <ThemedText type="small">
                {blocked === 'interest' ? 'Expressing interest' : 'Asking a question'} needs a student account. You’ll come back
                to this listing afterwards, and nothing is sent until you confirm it.
              </ThemedText>
            </Notice>
            <Button label="Log in" onPress={() => router.push(withReturnPath('/auth/login', here))} />
            <Button variant="secondary" label="Create an account" onPress={() => router.push(withReturnPath('/auth/register', here))} />
          </>
        ) : (
          <>
            <Notice tone="error">
              Verify your email before sending inquiries. Open the link we emailed you, or resend it from your account.
            </Notice>
            <Button variant="secondary" label="Go to account" onPress={() => router.push('/account')} />
          </>
        )}
        <Button variant="secondary" label="Not now" onPress={() => setBlocked(null)} />
      </Heading>
    );
  }
  return <Heading><EntryButtons onPress={setBlocked} /></Heading>;
}

/** The inquiry block on a listing, with its section heading. */
export function Heading({ children }: { children: ReactNode }) {
  return (
    <View style={styles.panel} accessibilityLiveRegion="polite">
      <ThemedText type="smallBold" accessibilityRole="header">Interested in this place?</ThemedText>
      {children}
    </View>
  );
}

export function EntryButtons({ onPress, busy }: { onPress: (kind: InquiryKind) => void; busy?: InquiryKind | null }) {
  return (
    <View style={styles.panel}>
      <Button label="I’m interested" busy={busy === 'interest'} disabled={Boolean(busy)} onPress={() => onPress('interest')} />
      <Button variant="secondary" label="Ask a question" disabled={Boolean(busy)} onPress={() => onPress('question')} />
    </View>
  );
}

const styles = StyleSheet.create({ panel: { gap: Spacing.three } });
