import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, Notice } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useViewer } from '@/lib/viewer-provider';
import { access } from '@/services/access';
import { savedListings } from '@/services/backend';
import { backendError } from '@/services/errors';

export function ListingBookmark({ listingId }: { listingId: string }) {
  const { viewer } = useViewer();
  if (viewer.kind !== 'member' || !access('saved', viewer).allowed) return null;

  return <BookmarkControl key={`${viewer.profile.id}:${listingId}`} listingId={listingId} />;
}

function BookmarkControl({ listingId }: { listingId: string }) {
  const focused = useIsFocused();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const writing = useRef(false);

  useEffect(() => {
    // A pending write will supply the latest state when it completes.
    if (!focused || writing.current) return;
    let active = true;
    setSaved(null);
    setError(null);
    savedListings.status(listingId).then(
      (result) => { if (active) setSaved(result.saved); },
      (failure) => { if (active) setError(backendError(failure).error.message); },
    );
    return () => { active = false; };
  }, [listingId, focused, attempt]);

  async function update() {
    if (saved === null || writing.current) return;
    writing.current = true;
    setBusy(true);
    setError(null);
    // Send an explicit target state so retrying a lost response cannot toggle it back.
    try {
      const result = await savedListings.set(listingId, !saved);
      setSaved(result.saved);
    } catch (failure) {
      const action = saved ? 'remove this listing from Saved Properties' : 'save this listing';
      setError(`Couldn’t ${action}. ${backendError(failure).error.message}`);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.control}>
      {saved === null ? (
        error ? (
          <>
            <Notice tone="error">{`Couldn’t check whether this listing is saved. ${error}`}</Notice>
            <Button variant="secondary" label="Retry checking bookmark" onPress={() => setAttempt((value) => value + 1)} />
          </>
        ) : (
          <View style={styles.loading} accessibilityLiveRegion="polite">
            <ActivityIndicator />
            <ThemedText type="small" themeColor="textSecondary">Checking bookmark…</ThemedText>
          </View>
        )
      ) : (
        <>
          <Button
            variant="secondary"
            label={saved ? 'Saved · Remove bookmark' : 'Save listing'}
            busy={busy}
            onPress={update}
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  control: { gap: Spacing.two },
  loading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
