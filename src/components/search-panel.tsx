import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FilterChip } from '@/components/filter-chip';
import { Notice, TextField } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAmenities } from '@/hooks/use-amenities';
import type { PropertyType } from '@/services/contracts';
import { propertyTypeLabel } from '@/services/listing-format';
import { activeFilterCount, KEYWORD_MAX, type SearchErrors, type SearchForm } from '@/services/listing-search';

const TYPES: PropertyType[] = ['bedspace', 'room', 'apartment'];

/**
 * Keyword search plus type, price and amenity filters for Browse (FR12). The filters fold away behind a
 * button so the feed stays visible on 360px phones (NFR2).
 */
export function SearchPanel({ form, errors, priceRangeActive, onChange, onClear }: {
  form: SearchForm;
  errors: SearchErrors;
  /** True once a valid price range is applied, so hidden-price listings are being left out. */
  priceRangeActive: boolean;
  onChange: (patch: Partial<SearchForm>) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(form);
  const anything = count > 0 || form.q.trim().length > 0;
  const toggleAmenity = (name: string) =>
    onChange({ amenities: form.amenities.includes(name) ? form.amenities.filter((a) => a !== name) : [...form.amenities, name] });

  return (
    <View style={styles.panel}>
      <TextField label="Search listings" value={form.q} onChangeText={(q) => onChange({ q })} error={errors.q}
        placeholder="Title, street, or area" returnKeyType="search" autoCorrect={false} autoCapitalize="none"
        maxLength={KEYWORD_MAX} />

      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <ThemedText type="linkPrimary">{open ? 'Hide filters' : 'Filters'}{count ? ` (${count})` : ''}</ThemedText>
        </Pressable>
        {anything && (
          <Pressable accessibilityRole="button" onPress={onClear} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
            <ThemedText type="linkPrimary">Clear all</ThemedText>
          </Pressable>
        )}
      </View>

      {open && (
        <View style={styles.filters}>
          <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Property type">
            <ThemedText type="smallBold">Property type</ThemedText>
            <View style={styles.chips}>
              <FilterChip role="radio" label="Any" selected={form.type === null} onPress={() => onChange({ type: null })} />
              {TYPES.map((type) => (
                <FilterChip key={type} role="radio" label={propertyTypeLabel(type)} selected={form.type === type}
                  onPress={() => onChange({ type })} />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <ThemedText type="smallBold">Price (₱)</ThemedText>
            <View style={styles.prices}>
              <View style={styles.price}>
                <TextField label="Minimum" value={form.minPrice} onChangeText={(minPrice) => onChange({ minPrice })}
                  error={errors.minPrice} placeholder="0" keyboardType="decimal-pad" inputMode="decimal" maxLength={12} />
              </View>
              <View style={styles.price}>
                <TextField label="Maximum" value={form.maxPrice} onChangeText={(maxPrice) => onChange({ maxPrice })}
                  error={errors.maxPrice} placeholder="Any" keyboardType="decimal-pad" inputMode="decimal" maxLength={12} />
              </View>
            </View>
            <ThemedText type="small" themeColor="textSecondary">Compares the listed amount, per month or per semester.</ThemedText>
          </View>

          <AmenityFilter selected={form.amenities} onToggle={toggleAmenity} />
        </View>
      )}

      {priceRangeActive && (
        <Notice tone="info">Listings that don’t show a price are left out while a price range is set.</Notice>
      )}
    </View>
  );
}

function AmenityFilter({ selected, onToggle }: { selected: string[]; onToggle: (name: string) => void }) {
  const { names, status, retry } = useAmenities();
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold">Amenities</ThemedText>
      {status === 'loading' && <ThemedText type="small" themeColor="textSecondary">Loading amenities…</ThemedText>}
      {status === 'error' && (
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">Couldn’t load amenities.</ThemedText>
          <Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
            <ThemedText type="linkPrimary">Try again</ThemedText>
          </Pressable>
        </View>
      )}
      {status === 'ready' && (
        <View style={styles.chips}>
          {names.map((name) => <FilterChip key={name} label={name} selected={selected.includes(name)} onPress={() => onToggle(name)} />)}
        </View>
      )}
      {selected.length > 1 && (
        <ThemedText type="small" themeColor="textSecondary">Shows listings that have all selected amenities.</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, flexWrap: 'wrap' },
  link: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  filters: { gap: Spacing.four, paddingVertical: Spacing.two },
  group: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  prices: { flexDirection: 'row', gap: Spacing.three },
  price: { flex: 1, minWidth: 0 },
});
