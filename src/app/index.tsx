import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListingCard } from '@/components/listing-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useListingFeed } from '@/hooks/use-listing-feed';
import { useTheme } from '@/hooks/use-theme';

const TWO_COLUMN_WIDTH = 720;

export default function BrowseScreen() {
  const feed = useListingFeed();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = width >= TWO_COLUMN_WIDTH ? 2 : 1;
  // Fixed widths keep a lone last card the same size as its row neighbours.
  const cardWidth = (Math.min(width, MaxContentWidth) - Spacing.three * (columns + 1)) / columns;
  const firstLoad = feed.items.length === 0;

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        key={columns}
        data={feed.items}
        numColumns={columns}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={columns > 1 ? { width: cardWidth } : styles.full}>
            <ListingCard listing={item} />
          </View>
        )}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        style={styles.list}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : insets.top + Spacing.three,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
          },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="subtitle" accessibilityRole="header">Find a place near UPV</ThemedText>
            <ThemedText themeColor="textSecondary">
              Browse published bedspaces, rooms, and apartments. No account needed.
            </ThemedText>
          </View>
        }
        ListEmptyComponent={
          firstLoad ? (
            <FeedMessage
              busy={feed.status === 'loading' || feed.status === 'refreshing'}
              title={feed.status === 'error' ? 'Couldn’t load listings' : feed.status === 'ready' ? 'No listings yet' : 'Loading listings…'}
              body={feed.status === 'error' ? feed.error : feed.status === 'ready' ? 'Check back soon. Owners are still adding places.' : null}
              action={feed.status === 'error' ? { label: 'Try again', onPress: feed.retry } : undefined}
            />
          ) : undefined
        }
        ListFooterComponent={
          firstLoad ? undefined : (
            <View style={styles.footer} accessibilityLiveRegion="polite">
              {feed.status === 'loading-more' && <ActivityIndicator accessibilityLabel="Loading more listings" />}
              {feed.status === 'error' && (
                <FeedMessage title="Couldn’t load more listings" body={feed.error} action={{ label: 'Try again', onPress: feed.retry }} />
              )}
              {feed.status === 'ready' && feed.hasMore && <Button label="Load more" onPress={feed.loadMore} />}
              {feed.status === 'ready' && !feed.hasMore && (
                <ThemedText type="small" themeColor="textSecondary">You’ve seen all {feed.items.length} listings.</ThemedText>
              )}
            </View>
          )
        }
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={feed.status === 'refreshing'} onRefresh={feed.refresh} tintColor={theme.textSecondary} />
        }
      />
    </ThemedView>
  );
}

function FeedMessage({ title, body, busy, action }: {
  title: string; body?: string | null; busy?: boolean; action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.message} accessibilityLiveRegion="polite">
      {busy && <ActivityIndicator />}
      <ThemedText type="smallBold">{title}</ThemedText>
      {body ? <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{body}</ThemedText> : null}
      {action && <Button label={action.label} onPress={action.onPress} />}
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <ThemedView type="backgroundSelected" style={styles.buttonInner}>
        <ThemedText type="smallBold">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.three, gap: Spacing.three },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  row: { gap: Spacing.three },
  full: { width: '100%' },
  footer: { alignItems: 'center', paddingVertical: Spacing.three, minHeight: 48 },
  message: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  center: { textAlign: 'center' },
  button: { minHeight: 44, borderRadius: Spacing.three, overflow: 'hidden' },
  buttonInner: { minHeight: 44, paddingHorizontal: Spacing.four, justifyContent: 'center', borderRadius: Spacing.three },
  pressed: { opacity: 0.7 },
});
