import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, ERROR_COLOR } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PHOTO_MAX, photoProblem, type PickedPhoto } from '@/services/listing-form';

let counter = 0;

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedPhoto {
  const file = asset.file;
  return {
    key: `${Date.now()}-${counter++}`,
    uri: asset.uri,
    name: asset.fileName ?? file?.name ?? 'photo',
    type: asset.mimeType ?? file?.type ?? '',
    size: asset.fileSize ?? file?.size ?? null,
    file,
  };
}

/**
 * FR9 photo selection. The first photo is the cover. Files are checked against the upload rules as they
 * are picked; the media function checks them again and strips their metadata.
 */
export function PhotoPicker({ photos, onChange, error, status, disabled }: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  error?: string;
  /** Per-photo upload state from the last attempt: stored, or why it failed. */
  status: { uploaded: Record<string, string>; errors: Record<string, string> };
  disabled?: boolean;
}) {
  const theme = useTheme();
  const room = PHOTO_MAX - photos.length;

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      orderedSelection: true,
      exif: false,
      // Hands over JPEG for HEIC library photos on iOS, which the upload rules accept.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || !result.assets?.length) return;
    onChange([...photos, ...result.assets.slice(0, room).map(toPicked)]);
  };

  const move = (index: number, by: -1 | 1) => {
    const next = [...photos];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };

  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" nativeID="photos-label">Photos</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Up to {PHOTO_MAX} JPEG, PNG, or WebP photos, 5 MB each. The first photo is the cover. Location data is removed when uploaded.
      </ThemedText>
      {photos.map((photo, index) => {
        const problem = photoProblem(photo) ?? status.errors[photo.key];
        const stored = Boolean(status.uploaded[photo.key]);
        return (
          <View key={photo.key} style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: problem ? ERROR_COLOR : 'transparent' }]}>
            <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" accessibilityIgnoresInvertColors
              accessibilityLabel={`Photo ${index + 1}${index === 0 ? ', cover' : ''}`} />
            <View style={styles.info}>
              <ThemedText type="small" numberOfLines={1}>{index === 0 ? 'Cover · ' : ''}{photo.name}</ThemedText>
              {problem
                ? <ThemedText type="small" style={{ color: ERROR_COLOR }}>{problem}</ThemedText>
                : stored ? <ThemedText type="small" themeColor="textSecondary">Uploaded</ThemedText> : null}
              <View style={styles.actions}>
                {index > 0 && <SmallAction label="Move up" a11y={`Move photo ${index + 1} up`} onPress={() => move(index, -1)} disabled={disabled} />}
                {index < photos.length - 1 && <SmallAction label="Move down" a11y={`Move photo ${index + 1} down`} onPress={() => move(index, 1)} disabled={disabled} />}
                <SmallAction label="Remove" a11y={`Remove photo ${index + 1}`} onPress={() => onChange(photos.filter((p) => p.key !== photo.key))} disabled={disabled} />
              </View>
            </View>
          </View>
        );
      })}
      {room > 0
        ? <Button variant="secondary" label={photos.length ? 'Add more photos' : 'Add photos'} onPress={pick} disabled={disabled} />
        : <ThemedText type="small" themeColor="textSecondary">You’ve added the maximum of {PHOTO_MAX} photos.</ThemedText>}
      {error ? <ThemedText type="small" style={{ color: ERROR_COLOR }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
    </View>
  );
}

function SmallAction({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled} onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.small, (pressed || disabled) && styles.dimmed]}>
      <ThemedText type="linkPrimary">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.two, borderRadius: Spacing.three, borderWidth: 2, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: Spacing.two },
  info: { flex: 1, minWidth: 0, gap: Spacing.half },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.three },
  small: { minHeight: 44, justifyContent: 'center' },
  dimmed: { opacity: 0.5 },
});
