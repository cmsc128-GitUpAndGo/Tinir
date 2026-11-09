import { router } from 'expo-router';

import { ListingCard } from '@/components/listing-card';
import { PagedList } from '@/components/paged-list';
import { RoleGate } from '@/components/role-gate';
import { ThemedText } from '@/components/themed-text';
import { usePagedFeed } from '@/hooks/use-listing-feed';
import { savedListings } from '@/services/backend';

/** Student-only (FR5). The server returns only the caller's own saved listings. */
export default function SavedScreen() {
  return <RoleGate area="saved">{() => <SavedList />}</RoleGate>;
}

function SavedList() {
  const feed = usePagedFeed(savedListings.list);
  return (
    <PagedList
      feed={feed}
      grid
      noun="saved listings"
      renderItem={(item) => <ListingCard listing={item} />}
      empty={{
        title: 'No saved listings yet',
        body: 'Save places while you browse to compare them here.',
        action: { label: 'Browse listings', onPress: () => router.navigate('/') },
      }}
      header={<ThemedText type="subtitle" accessibilityRole="header">Saved listings</ThemedText>}
    />
  );
}
