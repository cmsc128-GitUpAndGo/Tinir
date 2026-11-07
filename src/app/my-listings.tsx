import { StyleSheet, View } from 'react-native';

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
  return (
    <PagedList
      feed={feed}
      grid
      noun="listings"
      renderItem={(item) => (
        <View style={styles.item}>
          <ThemedText type="smallBold" themeColor="textSecondary">{STATUS[item.status]}</ThemedText>
          <ListingCard listing={item} />
        </View>
      )}
      empty={{ title: 'No listings yet', body: 'Listings you create appear here, including drafts.' }}
      header={<ThemedText type="subtitle" accessibilityRole="header">My listings</ThemedText>}
    />
  );
}

const styles = StyleSheet.create({ item: { gap: Spacing.one } });
