import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Notice } from '@/components/form';
import { PagedList } from '@/components/paged-list';
import { RoleGate } from '@/components/role-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePagedFeed } from '@/hooks/use-listing-feed';
import { inquiries } from '@/services/backend';
import type { Inquiry, Role } from '@/services/contracts';
import { decisionLabel } from '@/services/inquiry';
import { formatDate } from '@/services/listing-format';

const BADGE: Record<Inquiry['status'], string> = { pending: '#B54708', accepted: '#067647', rejected: '#B42318' };

/** Students see inquiries they sent (FR8); owners see inquiries on their own listings (FR5). */
export default function InquiriesScreen() {
  return <RoleGate area="inquiries">{(profile) => <InquiryList key={profile.role} role={profile.role} />}</RoleGate>;
}

function InquiryList({ role }: { role: Role }) {
  const feed = usePagedFeed(role === 'owner' ? inquiries.received : inquiries.sent);
  const owner = role === 'owner';
  // Decisions are stored on the server; coming back to the tab fetches them again (FR8). The first focus
  // is the initial load, which the feed already makes.
  const focused = useRef(false);
  const { refresh } = feed;
  useFocusEffect(useCallback(() => {
    if (focused.current) refresh();
    focused.current = true;
  }, [refresh]));

  return (
    <PagedList
      feed={feed}
      noun="inquiries"
      renderItem={(item) => <InquiryRow inquiry={item} />}
      empty={owner
        ? { title: 'No inquiries yet', body: 'Questions and interest from students on your listings appear here.' }
        : {
          title: 'No inquiries yet',
          body: 'Inquiries you send to owners appear here with their status.',
          action: { label: 'Browse listings', onPress: () => router.navigate('/') },
        }}
      header={
        <>
          <ThemedText type="subtitle" accessibilityRole="header">Inquiries</ThemedText>
          <ThemedText themeColor="textSecondary">{owner ? 'Received on your listings.' : 'Sent to property owners.'}</ThemedText>
          {!owner && (
            <Notice tone="info">
              Owners mark each inquiry Accepted or Rejected. Accepted means the owner is open to it; it doesn’t confirm a
              room or booking.
            </Notice>
          )}
          <Pressable accessibilityRole="button" onPress={refresh} disabled={feed.status !== 'ready' && feed.status !== 'error'}
            style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}>
            <ThemedText type="linkPrimary">Refresh</ThemedText>
          </Pressable>
        </>
      }
    />
  );
}

function InquiryRow({ inquiry }: { inquiry: Inquiry }) {
  const kind = inquiry.type === 'interest' ? 'Interest' : 'Question';
  const status = decisionLabel(inquiry.status);
  const sent = formatDate(inquiry.created_at);
  const decided = inquiry.status !== 'pending' ? formatDate(inquiry.status_updated_at) : '';
  const title = inquiry.listing_title ?? 'Listing';
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <View style={styles.top}>
        <ThemedText type="smallBold" themeColor="textSecondary">{kind.toUpperCase()}</ThemedText>
        <View style={[styles.badge, { backgroundColor: BADGE[inquiry.status] }]}>
          <ThemedText type="smallBold" style={styles.badgeText}>{status}</ThemedText>
        </View>
      </View>
      <Link href={{ pathname: '/listing/[id]', params: { id: inquiry.listing_id } }} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={`${title}. ${kind}, ${status}.`} accessibilityHint="Opens the listing"
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <ThemedText style={styles.title}>{title}</ThemedText>
        </Pressable>
      </Link>
      {inquiry.message ? <ThemedText type="small" numberOfLines={3}>{inquiry.message}</ThemedText> : null}
      <ThemedText type="small" themeColor="textSecondary">
        Sent {sent}{decided ? ` · ${status} ${decided}` : ''}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.two },
  badgeText: { color: '#ffffff' },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontSize: 17, lineHeight: 24, fontWeight: 600 },
  refresh: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  pressed: { opacity: 0.7 },
});
