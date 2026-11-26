import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/form';
import { ListingCard } from '@/components/listing-card';
import { PagedList } from '@/components/paged-list';
import { RoleGate } from '@/components/role-gate';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePagedFeed } from '@/hooks/use-listing-feed';
import { listings } from '@/services/backend';
import type { ManagedListing } from '@/services/contracts';

const STATUS: Record<ManagedListing['status'], string> = { draft: 'DRAFT', published: 'PUBLISHED', archived: 'ARCHIVED' };

/** Owner-only (FR5). The server returns only listings the caller owns, including drafts and archived ones. */
export default function MyListingsScreen() {
  return <RoleGate area="my-listings">{() => <OwnListings />}</RoleGate>;
}

function OwnListings() {
  const feed = usePagedFeed(listings.own);
  // Coming back from the new-listing form shows what was just saved. The first focus is the initial load.
  const focused = useRef(false);
  const { refresh } = feed;
  useFocusEffect(useCallback(() => {
    if (focused.current) refresh();
    focused.current = true;
  }, [refresh]));
  return (
    <PagedList
      feed={feed}
      grid
      noun="listings"
      renderItem={(item) => (
        <View style={styles.item}>
          <ThemedText type="smallBold" themeColor="textSecondary">{STATUS[item.status]}</ThemedText>
          {/* Only published listings have a public details page; drafts and archived ones get management in #17. */}
          <ListingCard listing={item} link={item.status === 'published'} />
        </View>
      )}
      empty={{ title: 'No listings yet', body: 'Listings you create appear here, including drafts.' }}
      header={(
        <View style={styles.header}>
          <ThemedText type="subtitle" accessibilityRole="header">My listings</ThemedText>
          <View style={styles.action}>
            <Button label="Create listing" onPress={() => router.push('/my-listings/new')} />
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  item: { gap: Spacing.one },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  action: { minWidth: 160 },
});
