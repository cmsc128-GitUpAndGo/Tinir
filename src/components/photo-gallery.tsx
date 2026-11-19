import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { usePhotoUrl } from '@/hooks/use-photo-url';
import type { Photo } from '@/services/contracts';

/**
 * Swipeable listing photos (FR6). Photos are requested one ahead of the one shown, so opening a listing does
 * not fetch all ten signed URLs at once. Previous/Next buttons make it usable without swiping (NFR11).
 */
export function PhotoGallery({ photos, title }: { photos: Photo[]; title: string }) {
  const ordered = [...photos].sort((a, b) => a.sort_order - b.sort_order);
  const scroller = useRef<ScrollViewInstance>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [reached, setReached] = useState(0);

  if (ordered.length === 0) {
    return (
      <ThemedView type="backgroundSelected" style={[styles.frame, styles.center]}>
        <ThemedText type="small" themeColor="textSecondary">No photos available</ThemedText>
      </ThemedView>
    );
  }

  const show = (next: number) => {
    const clamped = Math.max(0, Math.min(ordered.length - 1, next));
    setIndex(clamped);
    setReached((value) => Math.max(value, clamped));
    scroller.current?.scrollTo({ x: clamped * width, animated: true });
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const current = Math.round(event.nativeEvent.contentOffset.x / width);
    if (current !== index && current >= 0 && current < ordered.length) {
      setIndex(current);
      setReached((value) => Math.max(value, current));
    }
  };

  return (
    <View style={styles.frame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        accessibilityLabel={`Photos of ${title}`}>
        {ordered.map((photo, i) => (
          <View key={photo.id} style={{ width, height: '100%' }}>
            <GalleryPhoto
              id={i <= reached + 1 ? photo.id : undefined}
              label={`Photo ${i + 1} of ${ordered.length} of ${title}`}
            />
          </View>
        ))}
      </ScrollView>
      {ordered.length > 1 && (
        <>
          <View style={styles.counter}>
            <ThemedText type="smallBold" style={styles.counterText} accessibilityLiveRegion="polite">
              {index + 1} / {ordered.length}
            </ThemedText>
          </View>
          {index > 0 && <Arrow side="left" label="Previous photo" onPress={() => show(index - 1)} />}
          {index < ordered.length - 1 && <Arrow side="right" label="Next photo" onPress={() => show(index + 1)} />}
        </>
      )}
    </View>
  );
}

function GalleryPhoto({ id, label }: { id: string | undefined; label: string }) {
  const { url, failed } = usePhotoUrl(id);
  if (url && id) {
    return (
      <Image
        source={{ uri: url, cacheKey: `listing-photo-${id}` }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
        accessible
        accessibilityLabel={label}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <ThemedView type="backgroundSelected" style={[StyleSheet.absoluteFill, styles.center]}>
      <ThemedText type="small" themeColor="textSecondary">{failed ? 'Photo unavailable' : 'Loading photo…'}</ThemedText>
    </ThemedView>
  );
}

function Arrow({ side, label, onPress }: { side: 'left' | 'right'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.arrow, side === 'left' ? styles.left : styles.right, pressed && styles.pressed]}>
      <ThemedText style={styles.arrowText}>{side === 'left' ? '‹' : '›'}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 4 / 3, borderRadius: Spacing.three, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  counter: {
    position: 'absolute', bottom: Spacing.two, right: Spacing.two, backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.two, paddingVertical: Spacing.half, borderRadius: Spacing.two, pointerEvents: 'none',
  },
  counterText: { color: '#ffffff' },
  arrow: {
    position: 'absolute', top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  left: { left: Spacing.two },
  right: { right: Spacing.two },
  arrowText: { color: '#ffffff', fontSize: 28, lineHeight: 32 },
  pressed: { opacity: 0.7 },
});
