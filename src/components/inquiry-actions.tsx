import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, Notice, TextField } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useViewer } from '@/lib/viewer-provider';
import { inquiries } from '@/services/backend';
import { QUESTION_MAX, sendFailure, validateQuestion } from '@/services/inquiry';
import { withReturnPath } from '@/services/return-path';

export type InquiryKind = 'interest' | 'question';

/**
 * The two inquiry entry points on a listing: "I'm interested" and "Ask a question" (FR2, FR7).
 * Verified students send from here. Guests get a log-in prompt that returns them to this listing without
 * sending anything; unverified accounts and owners are told why they cannot send. The server rejects the
 * same requests on its own.
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
  if (viewer.kind === 'member' && viewer.profile.email_verified) return <StudentInquiry listingId={listingId} />;

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

/**
 * A verified student sends interest in one tap or writes a question (FR7). A failed send keeps the typed
 * question; repeated interest taps are deduplicated by the server, which records the inquiry as Pending.
 */
function StudentInquiry({ listingId }: { listingId: string }) {
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [sending, setSending] = useState<InquiryKind | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const send = async (kind: InquiryKind) => {
    if (sending) return;
    let message: string | undefined;
    if (kind === 'question') {
      const checked = validateQuestion(draft);
      if (!checked.ok) { setFieldError(checked.error); return; }
      message = checked.value;
    }
    setResult(null);
    setSending(kind);
    try {
      await inquiries.send(listingId, kind, message);
      if (kind === 'question') { setDraft(''); setAsking(false); }
      setResult({
        tone: 'success',
        message: kind === 'interest'
          ? 'Interest sent. The owner can now see you’re interested. Tapping again won’t send it twice.'
          : 'Question sent to the owner.',
      });
    } catch (error) {
      setResult({ tone: 'error', message: sendFailure(error) });
    } finally {
      setSending(null);
    }
  };

  return (
    <Heading>
      {result ? (
        <Notice tone={result.tone}>
          <ThemedText type="small">{result.message}</ThemedText>
          {result.tone === 'success' ? (
            <ThemedText type="small">Track the owner’s reply under Inquiries. An accepted inquiry doesn’t reserve a room.</ThemedText>
          ) : null}
        </Notice>
      ) : null}
      {result?.tone === 'success' && <Button variant="secondary" label="View my inquiries" onPress={() => router.navigate('/inquiries')} />}
      {asking ? (
        <View style={styles.panel}>
          {/* Read-only while sending, so nothing typed after tapping Send is cleared by the success handler. */}
          <TextField label="Your question" value={draft} multiline maxLength={QUESTION_MAX} error={fieldError} editable={!sending}
            hint={`Up to ${QUESTION_MAX.toLocaleString('en-PH')} characters.`} placeholder="e.g. Is water included in the rent?"
            onChangeText={(value) => { setDraft(value); setFieldError(undefined); }} />
          <Button label="Send question" busy={sending === 'question'} disabled={Boolean(sending)} onPress={() => void send('question')} />
          <Button variant="secondary" label="Cancel" disabled={Boolean(sending)} onPress={() => { setAsking(false); setFieldError(undefined); }} />
        </View>
      ) : (
        <EntryButtons busy={sending} onPress={(kind) => (kind === 'interest' ? void send('interest') : setAsking(true))} />
      )}
    </Heading>
  );
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
