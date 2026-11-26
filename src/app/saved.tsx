import { router } from 'expo-router';

import { ListingCard } from '@/components/listing-card';
import { PagedList } from '@/components/paged-list';
import { RoleGate } from '@/components/role-gate';
import { ThemedText } from '@/components/themed-text';
import { usePagedFeed } from '@/hooks/use-listing-feed';
import { savedListings } from '@/services/backend';

/** Student-only (FR5). The server returns only the caller's own saved listings. */
export default function SavedScreen() {
  return <RoleGate area="saved">{(profile) => <SavedList key={profile.id} />}</RoleGate>;
}

function SavedList() {
  const feed = usePagedFeed(savedListings.list, { refreshOnFocus: true });
  return (
    <PagedList
      feed={feed}
      grid
      noun="saved listings"
      renderItem={(item) => <ListingCard listing={item} />}
      empty={{
        title: 'No saved listings yet',
        body: 'Open a listing and choose Save listing to find it here later.',
        action: { label: 'Browse listings', onPress: () => router.navigate('/') },
      }}
      header={<ThemedText type="subtitle" accessibilityRole="header">Saved Properties</ThemedText>}
    />
  );
}
