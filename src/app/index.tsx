import { ListingCard } from '@/components/listing-card';
import { PagedList } from '@/components/paged-list';
import { ThemedText } from '@/components/themed-text';
import { useListingFeed } from '@/hooks/use-listing-feed';

export default function BrowseScreen() {
  const feed = useListingFeed();
  return (
    <PagedList
      feed={feed}
      grid
      noun="listings"
      renderItem={(item) => <ListingCard listing={item} />}
      empty={{ title: 'No listings yet', body: 'Check back soon. Owners are still adding places.' }}
      header={
        <>
          <ThemedText type="subtitle" accessibilityRole="header">Find a place near UPV</ThemedText>
          <ThemedText themeColor="textSecondary">Browse published bedspaces, rooms, and apartments. No account needed.</ThemedText>
        </>
      }
    />
  );
}
