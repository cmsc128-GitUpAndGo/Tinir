import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import type { usePagedFeed } from '@/hooks/use-listing-feed';
import { useTheme } from '@/hooks/use-theme';

const TWO_COLUMN_WIDTH = 720;

type Feed<T extends { id: string }> = ReturnType<typeof usePagedFeed<T>>;

/**
 * Tab screen showing a paged backend list, with loading, empty, error, load-more and pull-to-refresh states.
 * `noun` is the plural used in status text, e.g. "listings".
 */
export function PagedList<T extends { id: string }>({ feed, header, renderItem, noun, empty, grid }: {
  feed: Feed<T>;
  header: ReactNode;
  renderItem: (item: T) => ReactElement;
  noun: string;
  empty: { title: string; body: string; action?: { label: string; onPress: () => void } };
  /** Lay items out in two columns on wide screens. */
  grid?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = grid && width >= TWO_COLUMN_WIDTH ? 2 : 1;
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
        renderItem={({ item }) => <View style={columns > 1 ? { width: cardWidth } : styles.full}>{renderItem(item)}</View>}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        style={styles.list}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : insets.top + Spacing.three,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
          },
        ]}
        ListHeaderComponent={<View style={styles.header}>{header}</View>}
        ListEmptyComponent={
          firstLoad ? (
            <ListMessage
              busy={feed.status === 'loading' || feed.status === 'refreshing'}
              title={feed.status === 'error' ? `Couldn’t load ${noun}` : feed.status === 'ready' ? empty.title : `Loading ${noun}…`}
              body={feed.status === 'error' ? feed.error : feed.status === 'ready' ? empty.body : null}
              action={feed.status === 'error' ? { label: 'Try again', onPress: feed.retry } : feed.status === 'ready' ? empty.action : undefined}
            />
          ) : undefined
        }
        ListFooterComponent={
          firstLoad ? undefined : (
            <View style={styles.footer} accessibilityLiveRegion="polite">
              {feed.status === 'loading-more' && <ActivityIndicator accessibilityLabel={`Loading more ${noun}`} />}
              {feed.status === 'error' && (
                <ListMessage title={`Couldn’t load more ${noun}`} body={feed.error} action={{ label: 'Try again', onPress: feed.retry }} />
              )}
              {feed.status === 'ready' && feed.hasMore && <ListButton label="Load more" onPress={feed.loadMore} />}
              {feed.status === 'ready' && !feed.hasMore && (
                <ThemedText type="small" themeColor="textSecondary">You’ve seen all {feed.items.length} {noun}.</ThemedText>
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

function ListMessage({ title, body, busy, action }: {
  title: string; body?: string | null; busy?: boolean; action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.message} accessibilityLiveRegion="polite">
      {busy && <ActivityIndicator />}
      <ThemedText type="smallBold">{title}</ThemedText>
      {body ? <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{body}</ThemedText> : null}
      {action && <ListButton label={action.label} onPress={action.onPress} />}
    </View>
  );
}

function ListButton({ label, onPress }: { label: string; onPress: () => void }) {
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
