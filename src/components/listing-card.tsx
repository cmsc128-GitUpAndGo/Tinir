import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePhotoUrl } from '@/hooks/use-photo-url';
import type { Listing } from '@/services/contracts';
import { priceLabel, propertyTypeLabel } from '@/services/listing-format';

/** A listing summary. With `link` (the default) it opens the listing's details (FR6). */
export function ListingCard({ listing, link = true }: { listing: Listing; link?: boolean }) {
  const label = cardLabel(listing);
  const card = <CardBody listing={listing} label={link ? undefined : label} />;
  if (!link) return card;
  return (
    <Link href={{ pathname: '/listing/[id]', params: { id: listing.id } }} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={label} accessibilityHint="Opens the listing details"
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
        {card}
      </Pressable>
    </Link>
  );
}

function cardLabel(listing: Listing) {
  const full = listing.availability_status === 'full';
  const location = listing.area.trim() || 'Location shared on the listing';
  return `${listing.title}. ${propertyTypeLabel(listing.property_type)}. ${location}. ${priceLabel(listing)}.${full ? ' Currently full.' : ''}`;
}

/** `label` makes the card one accessible element when it is not wrapped in a link. */
function CardBody({ listing, label }: { listing: Listing; label?: string }) {
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
      accessible={Boolean(label)}
      accessibilityLabel={label}>
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
  link: { flex: 1, borderRadius: Spacing.three },
  pressed: { opacity: 0.8 },
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
