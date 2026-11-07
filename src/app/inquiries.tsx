import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PagedList } from '@/components/paged-list';
import { RoleGate } from '@/components/role-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePagedFeed } from '@/hooks/use-listing-feed';
import { inquiries } from '@/services/backend';
import type { Inquiry, Role } from '@/services/contracts';

const STATUS: Record<Inquiry['status'], string> = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' };

/** Students see inquiries they sent; owners see inquiries on their own listings (FR5). */
export default function InquiriesScreen() {
  return <RoleGate area="inquiries">{(profile) => <InquiryList key={profile.role} role={profile.role} />}</RoleGate>;
}

function InquiryList({ role }: { role: Role }) {
  const feed = usePagedFeed(role === 'owner' ? inquiries.received : inquiries.sent);
  const owner = role === 'owner';
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
        </>
      }
    />
  );
}

function InquiryRow({ inquiry }: { inquiry: Inquiry }) {
  const kind = inquiry.type === 'interest' ? 'Interest' : 'Question';
  const sent = new Date(inquiry.created_at).toLocaleDateString();
  return (
    <ThemedView type="backgroundElement" style={styles.row}
      accessible accessibilityLabel={`${kind} about ${inquiry.listing_title ?? 'a listing'}, ${STATUS[inquiry.status]}, ${sent}`}>
      <ThemedText type="smallBold" themeColor="textSecondary">{kind.toUpperCase()} · {STATUS[inquiry.status].toUpperCase()}</ThemedText>
      <ThemedText style={styles.title}>{inquiry.listing_title ?? 'Listing'}</ThemedText>
      {inquiry.message ? <ThemedText type="small" numberOfLines={3}>{inquiry.message}</ThemedText> : null}
      <ThemedText type="small" themeColor="textSecondary">{sent}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.half },
  title: { fontSize: 17, lineHeight: 24, fontWeight: 600 },
});
