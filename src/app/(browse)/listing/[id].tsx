import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { Button, Notice } from '@/components/form';
import { PhotoGallery } from '@/components/photo-gallery';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useListingDetail } from '@/hooks/use-listing-detail';
import { useSession } from '@/lib/supabase/session-provider';
import type { ListingDetail } from '@/services/contracts';
import { availabilityLabel, formatDate, mapUrl, priceLabel, propertyTypeLabel } from '@/services/listing-format';

/**
 * Listing details (FR6). Guests see everything public; logged-in users also get the owner's contact details.
 * Hidden prices and guest contacts are left out by the server, not just hidden here (NFR8).
 */
export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, retry } = useListingDetail(id);
  // Only public fields ever reach the page title.
  const title = state.status === 'ready' ? state.listing.title : 'Listing';

  return (
    <DetailLayout title={title}>
      {state.status === 'loading' && (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <ActivityIndicator accessibilityLabel="Loading listing" />
          <ThemedText type="small" themeColor="textSecondary">Loading listing…</ThemedText>
        </View>
      )}
      {state.status === 'unavailable' && (
        <View style={styles.message}>
          <ThemedText type="subtitle" style={styles.title} accessibilityRole="header">Listing unavailable</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            This listing may have been removed by its owner or is no longer published.
          </ThemedText>
          <Button variant="secondary" label="Browse other listings" onPress={() => router.replace('/')} />
        </View>
      )}
      {state.status === 'error' && (
        <View style={styles.message}>
          <ThemedText type="smallBold">Couldn’t load this listing</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>{state.message}</ThemedText>
          <Button variant="secondary" label="Try again" onPress={retry} />
        </View>
      )}
      {state.status === 'ready' && <ListingBody listing={state.listing} />}
    </DetailLayout>
  );
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function DetailLayout({ title, children }: { title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={[styles.content, {
        paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : insets.top + Spacing.two,
        paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
      }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <ThemedText type="linkPrimary">‹ Back</ThemedText>
        </Pressable>
        {children}
      </ScrollView>
    </ThemedView>
  );
}

function ListingBody({ listing }: { listing: ListingDetail }) {
  const full = listing.availability_status === 'full';
  const map = mapUrl(listing);
  const updated = formatDate(listing.updated_at);
  const confirmed = formatDate(listing.last_confirmed_at);
  return (
    <>
      <PhotoGallery photos={listing.photos} title={listing.title} />

      <View style={styles.summary}>
        <ThemedText type="smallBold" themeColor="textSecondary">{propertyTypeLabel(listing.property_type).toUpperCase()}</ThemedText>
        <ThemedText style={styles.title} accessibilityRole="header">{listing.title}</ThemedText>
        {listing.area.trim() ? <ThemedText themeColor="textSecondary">{listing.area}</ThemedText> : null}
        <ThemedText style={styles.price}>{priceLabel(listing)}</ThemedText>
        <View style={[styles.badge, full ? styles.badgeFull : styles.badgeOpen]}>
          <ThemedText type="smallBold" style={styles.badgeText}>{availabilityLabel(listing)}</ThemedText>
        </View>
      </View>

      <Section title="Location">
        <ThemedText selectable>{listing.address}</ThemedText>
        {map ? (
          <ExternalLink href={map} accessibilityRole="link" accessibilityHint="Opens a map in your browser">
            <ThemedText type="linkPrimary">Open in maps</ThemedText>
          </ExternalLink>
        ) : null}
      </Section>

      <Section title="About this place">
        <ThemedText selectable themeColor={listing.description.trim() ? 'text' : 'textSecondary'}>
          {listing.description.trim() || 'The owner hasn’t added a description yet.'}
        </ThemedText>
      </Section>

      <Section title="Amenities">
        {listing.amenities.length ? (
          <View style={styles.chips}>
            {listing.amenities.map((name) => (
              <ThemedView key={name} type="backgroundElement" style={styles.chip}>
                <ThemedText type="small">{name}</ThemedText>
              </ThemedView>
            ))}
          </View>
        ) : (
          <ThemedText themeColor="textSecondary">No amenities listed.</ThemedText>
        )}
      </Section>

      <Section title="House rules">
        <ThemedText selectable themeColor={listing.house_rules.trim() ? 'text' : 'textSecondary'}>
          {listing.house_rules.trim() || 'No house rules listed.'}
        </ThemedText>
      </Section>

      <OwnerContact listing={listing} />

      <View style={styles.footer}>
        {updated ? <ThemedText type="small" themeColor="textSecondary">Last updated {updated}</ThemedText> : null}
        {confirmed ? <ThemedText type="small" themeColor="textSecondary">Owner confirmed this listing on {confirmed}</ThemedText> : null}
      </View>
    </>
  );
}

function OwnerContact({ listing }: { listing: ListingDetail }) {
  const { session } = useSession();
  const contact = listing.owner_contact;
  if (contact) {
    const phone = contact.contact_number?.trim();
    return (
      <Section title="Contact the owner">
        <ThemedText selectable style={styles.ownerName}>{contact.full_name}</ThemedText>
        {phone ? (
          <ContactLink label={phone} hint="Calls the owner" url={`tel:${phone.replace(/[\s-]/g, '')}`} />
        ) : null}
        <ContactLink label={contact.email} hint="Writes an email to the owner" url={`mailto:${contact.email}`} />
      </Section>
    );
  }
  return (
    <Section title="Contact the owner">
      {session ? (
        <Notice tone="info">Owner contact details are unavailable right now. Log in again to see them.</Notice>
      ) : (
        <>
          <ThemedText themeColor="textSecondary">Log in or create an account to see the owner’s contact details.</ThemedText>
          <Button label="Log in" onPress={() => router.push('/auth/login')} />
          <Button variant="secondary" label="Create an account" onPress={() => router.push('/auth/register')} />
        </>
      )}
    </Section>
  );
}

function ContactLink({ label, hint, url }: { label: string; hint: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityHint={hint} onPress={() => void Linking.openURL(url).catch(() => {})}
      style={({ pressed }) => [styles.contact, pressed && styles.pressed]}>
      <ThemedText type="linkPrimary" selectable>{label}</ThemedText>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">{title}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: Spacing.three, gap: Spacing.four },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  pressed: { opacity: 0.7 },
  message: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five },
  centerText: { textAlign: 'center' },
  summary: { gap: Spacing.one },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 600 },
  price: { fontSize: 20, lineHeight: 28, fontWeight: 700, marginTop: Spacing.one },
  badge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.two, marginTop: Spacing.one },
  badgeOpen: { backgroundColor: '#067647' },
  badgeFull: { backgroundColor: '#B42318' },
  badgeText: { color: '#ffffff' },
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.four },
  ownerName: { fontWeight: 600 },
  contact: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  footer: { gap: Spacing.half },
});
