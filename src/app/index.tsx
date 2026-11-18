import { useEffect, useState } from 'react';

import { ListingCard } from '@/components/listing-card';
import { PagedList } from '@/components/paged-list';
import { SearchPanel } from '@/components/search-panel';
import { ThemedText } from '@/components/themed-text';
import { useListingFeed } from '@/hooks/use-listing-feed';
import type { ListingFilters } from '@/services/contracts';
import { emptySearch, hasPriceRange, isFiltered, toFilters, type SearchErrors, type SearchForm } from '@/services/listing-search';

/** Typing pauses this long before the results change, so each keystroke is not a request. */
const SEARCH_DELAY_MS = 350;

export default function BrowseScreen() {
  const [form, setForm] = useState<SearchForm>(emptySearch);
  const [applied, setApplied] = useState<ListingFilters>({});
  const [errors, setErrors] = useState<SearchErrors>({});
  const feed = useListingFeed(applied);

  // Apply the form once typing pauses. An invalid range keeps the current results and explains the problem.
  useEffect(() => {
    const timer = setTimeout(() => {
      const result = toFilters(form);
      if (result.ok) {
        setErrors({});
        setApplied(result.filters);
      } else {
        setErrors(result.errors);
      }
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [form]);

  const clear = () => setForm(emptySearch);
  const filtered = isFiltered(applied);

  return (
    <PagedList
      feed={feed}
      grid
      noun={filtered ? 'matching listings' : 'listings'}
      renderItem={(item) => <ListingCard listing={item} />}
      empty={filtered
        ? { title: 'No listings match', body: 'Try another keyword or fewer filters.', action: { label: 'Clear search and filters', onPress: clear } }
        : { title: 'No listings yet', body: 'Check back soon. Owners are still adding places.' }}
      header={
        <>
          <ThemedText type="subtitle" accessibilityRole="header">Find a place near UPV</ThemedText>
          <ThemedText themeColor="textSecondary">Browse published bedspaces, rooms, and apartments. No account needed.</ThemedText>
          <SearchPanel form={form} errors={errors} priceRangeActive={hasPriceRange(applied)}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} onClear={clear} />
        </>
      }
    />
  );
}
