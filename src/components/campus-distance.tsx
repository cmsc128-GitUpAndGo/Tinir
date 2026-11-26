import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, Notice } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCampusDistance } from '@/hooks/use-campus-distance';
import { useViewer } from '@/lib/viewer-provider';
import { distanceLabel } from '@/services/campus-distance';

/**
 * Distance from a listing to the campus (FR14). Only verified students get it (PRD §5); the server rejects
 * everyone else on its own (NFR5).
 */
export function CampusDistance({ listingId }: { listingId: string }) {
  const { viewer } = useViewer();
  if (viewer.kind !== 'member' || viewer.profile.role !== 'student' || !viewer.profile.email_verified) return null;
  return <DistanceList key={viewer.profile.id} listingId={listingId} />;
}

function DistanceList({ listingId }: { listingId: string }) {
  const { state, retry } = useCampusDistance(listingId);

  return (
    <View style={styles.block} accessibilityLiveRegion="polite">
      {state.status === 'loading' && (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Calculating campus distance" />
          <ThemedText type="small" themeColor="textSecondary">Calculating campus distance…</ThemedText>
        </View>
      )}
      {state.status === 'not-configured' && (
        <Notice tone="info">Campus distance isn’t available yet because the campus location hasn’t been set up.</Notice>
      )}
      {state.status === 'error' && (
        <>
          <Notice tone="error">{`Couldn’t get the campus distance. ${state.message}`}</Notice>
          <Button variant="secondary" label="Retry campus distance" onPress={retry} />
        </>
      )}
      {state.status === 'ready' && (
        <>
          {state.distances.map(({ campusId, campusName, km }) => (
            <ThemedText key={campusId} type="small">
              <ThemedText type="smallBold">{distanceLabel(km)}</ThemedText>
              {km === null ? ` for ${campusName}` : ` to ${campusName}`}
            </ThemedText>
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            Straight-line estimate. Walking or travel distance may be longer.
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.two },
  loading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
