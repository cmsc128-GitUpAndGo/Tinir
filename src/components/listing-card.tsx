import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePhotoUrl } from '@/hooks/use-photo-url';
import type { Listing } from '@/services/contracts';
import { priceLabel, propertyTypeLabel } from '@/services/listing-format';

export function ListingCard({ listing }: { listing: Listing }) {
  const cover = [...listing.photos].sort((a, b) => a.sort_order - b.sort_order)[0];
  const { url, failed } = usePhotoUrl(cover?.id);
  const type = propertyTypeLabel(listing.property_type);
  const price = priceLabel(listing);
  const full = listing.availability_status === 'full';
  const location = listing.area.trim() || 'Location shared on the listing';

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.card}
      accessible
      accessibilityLabel={`${listing.title}. ${type}. ${location}. ${price}.${full ? ' Currently full.' : ''}`}>
      <View style={styles.media}>
        {url ? (
          <Image
            source={{ uri: url, cacheKey: `listing-photo-${cover!.id}` }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <ThemedView type="backgroundSelected" style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <ThemedText type="small" themeColor="textSecondary">
              {!cover || failed ? 'No photo available' : 'Loading photo…'}
            </ThemedText>
          </ThemedView>
        )}
        {full && (
          <View style={styles.badge}>
            <ThemedText type="smallBold" style={styles.badgeText}>Full</ThemedText>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <ThemedText type="smallBold" themeColor="textSecondary">{type.toUpperCase()}</ThemedText>
        <ThemedText style={styles.title} numberOfLines={2}>{listing.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{location}</ThemedText>
        <ThemedText type="smallBold" style={styles.price}>{price}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, overflow: 'hidden', flex: 1 },
  media: { aspectRatio: 16 / 10, width: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: Spacing.two, left: Spacing.two, backgroundColor: '#B42318',
    paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.two,
  },
  badgeText: { color: '#ffffff' },
  body: { padding: Spacing.three, gap: Spacing.half },
  title: { fontSize: 18, lineHeight: 24, fontWeight: 600 },
  price: { marginTop: Spacing.one, fontSize: 16 },
});
