import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { FilterChip } from '@/components/filter-chip';
import { Button, Choice, ERROR_COLOR, Notice, TextField } from '@/components/form';
import { PhotoPicker } from '@/components/photo-picker';
import { RoleGate } from '@/components/role-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAmenities } from '@/hooks/use-amenities';
import { listings } from '@/services/backend';
import type { PropertyType } from '@/services/contracts';
import { emptyListing, LIMITS, parseCoordinates, validateListing, type ListingErrors, type ListingForm, type PickedPhoto } from '@/services/listing-form';
import { mapUrl } from '@/services/listing-format';
import { initialProgress, publishListing, type PublishApi, type PublishProgress, type PublishStep } from '@/services/listing-publish';
import { media } from '@/services/media';

const TYPES: { value: PropertyType; label: string; description: string }[] = [
  { value: 'bedspace', label: 'Bedspace', description: 'A bed in a shared room.' },
  { value: 'room', label: 'Room', description: 'A private room in a shared house.' },
  { value: 'apartment', label: 'Apartment', description: 'A whole unit.' },
];

const api: PublishApi = {
  create: listings.create,
  update: listings.update,
  // Web hands over the browser File; native uploads stream the local file by URI.
  upload: (id: string, photo: PickedPhoto) => media.upload(id, photo.file ?? { uri: photo.uri, name: photo.name, type: photo.type }),
  removePhoto: media.remove,
  publish: listings.publish,
};

/** FR9: a verified owner publishes a listing with details, photos and a price-visibility choice. */
export default function NewListingScreen() {
  return <RoleGate area="my-listings">{() => <NewListing />}</RoleGate>;
}

function stepLabel(step: PublishStep): string {
  if (step.step === 'saving') return 'Saving your listing…';
  if (step.step === 'uploading') return `Uploading photo ${step.index} of ${step.total}…`;
  return 'Publishing…';
}

function NewListing() {
  const [form, setForm] = useState<ListingForm>(emptyListing);
  const [errors, setErrors] = useState<ListingErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<PublishStep | null>(null);
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});
  // Kept across attempts so a retry reuses the draft and skips photos already stored.
  const progress = useRef<PublishProgress>(initialProgress);
  const [saved, setSaved] = useState<PublishProgress>(initialProgress);
  const busy = step !== null;

  const set = <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      // A changed location has to be checked on the map again.
      ...(key === 'coordinates' ? { coordinatesConfirmed: false } : {}),
    }));
    setErrors((current) => ({ ...current, [key]: undefined, ...(key === 'coordinates' ? { coordinatesConfirmed: undefined } : {}) }));
  };

  const submit = async () => {
    setFormError(null);
    const checked = validateListing(form);
    if (!checked.ok) {
      setErrors(checked.errors);
      setFormError('Check the highlighted fields.');
      return;
    }
    setPhotoErrors({});
    const result = await publishListing(checked.input, form.photos, progress.current, api, setStep);
    setStep(null);
    progress.current = result.progress;
    setSaved(result.progress);
    if (result.status === 'published') {
      router.replace(`/listing/${result.listing.id}`);
      return;
    }
    setPhotoErrors(result.photoErrors);
    setFormError(result.message);
  };

  const point = parseCoordinates(form.coordinates);
  const map = point ? mapUrl(point) : null;
  const draft = saved.draftId !== null;

  return (
    <FormLayout>
      <Section title="About the place">
        <TextField label="Title" value={form.title} onChangeText={(v) => set('title', v)} error={errors.title}
          placeholder="e.g. Quiet room near the UPV gate" maxLength={LIMITS.title} editable={!busy} />
        <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Property type">
          <ThemedText type="smallBold">Property type</ThemedText>
          {TYPES.map((type) => (
            <Choice key={type.value} label={type.label} description={type.description} selected={form.type === type.value}
              onPress={() => !busy && set('type', type.value)} />
          ))}
          <FieldError message={errors.type} />
        </View>
        <TextField label="Description" value={form.description} onChangeText={(v) => set('description', v)} error={errors.description}
          optional multiline maxLength={LIMITS.description} editable={!busy} />
        <TextField label="House rules" value={form.houseRules} onChangeText={(v) => set('houseRules', v)} error={errors.houseRules}
          optional multiline maxLength={LIMITS.houseRules} placeholder="e.g. Curfew at 10 PM, no pets" editable={!busy} />
        <Amenities selected={form.amenityIds} disabled={busy}
          onToggle={(id) => set('amenityIds', form.amenityIds.includes(id) ? form.amenityIds.filter((a) => a !== id) : [...form.amenityIds, id])} />
      </Section>

      <Section title="Location">
        <TextField label="Address" value={form.address} onChangeText={(v) => set('address', v)} error={errors.address}
          autoComplete="street-address" maxLength={LIMITS.address} editable={!busy} />
        <TextField label="Area" value={form.area} onChangeText={(v) => set('area', v)} error={errors.area} optional
          hint="A general area shown on listing cards, e.g. Sapa, Miagao." maxLength={LIMITS.area} editable={!busy} />
        <TextField label="Map coordinates" value={form.coordinates} onChangeText={(v) => set('coordinates', v)} error={errors.coordinates}
          hint="In a map app, press and hold the place, then copy its latitude and longitude." placeholder="10.643500, 122.228500"
          autoCapitalize="none" autoCorrect={false} keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} editable={!busy} />
        {map && (
          <View style={styles.group}>
            <ExternalLink href={map}><ThemedText type="linkPrimary">Check this pin on the map ↗</ThemedText></ExternalLink>
            <Checkbox label="The map pin shows my property" checked={form.coordinatesConfirmed} disabled={busy}
              onPress={() => { setForm((c) => ({ ...c, coordinatesConfirmed: !c.coordinatesConfirmed })); setErrors((c) => ({ ...c, coordinatesConfirmed: undefined })); }} />
            <FieldError message={errors.coordinatesConfirmed} />
          </View>
        )}
      </Section>

      <Section title="Price and availability">
        <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Price visibility">
          <ThemedText type="smallBold">Price visibility</ThemedText>
          <Choice label="Hide the price" description="Students see “Contact owner for price”." selected={!form.priceVisible}
            onPress={() => !busy && set('priceVisible', false)} />
          <Choice label="Show the price" description="Everyone browsing sees the amount." selected={form.priceVisible}
            onPress={() => !busy && set('priceVisible', true)} />
        </View>
        <TextField label="Price (₱)" value={form.price} onChangeText={(v) => set('price', v)} error={errors.price}
          optional={!form.priceVisible} hint={form.priceVisible ? undefined : 'Optional. Kept private while the price is hidden.'}
          placeholder="e.g. 2,500" keyboardType="decimal-pad" editable={!busy} />
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Price period">
          <FilterChip role="radio" label="Per month" selected={form.pricePeriod === 'monthly'} onPress={() => !busy && set('pricePeriod', 'monthly')} />
          <FilterChip role="radio" label="Per semester" selected={form.pricePeriod === 'semester'} onPress={() => !busy && set('pricePeriod', 'semester')} />
        </View>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Availability">
          <FilterChip role="radio" label="Available" selected={form.availability === 'available'} onPress={() => !busy && set('availability', 'available')} />
          <FilterChip role="radio" label="Full" selected={form.availability === 'full'} onPress={() => !busy && set('availability', 'full')} />
        </View>
        <TextField label="Open slots" value={form.slots} onChangeText={(v) => set('slots', v)} error={errors.slots} optional
          keyboardType="number-pad" maxLength={3} editable={!busy} />
      </Section>

      <Section title="Photos">
        <PhotoPicker photos={form.photos} onChange={(photos) => set('photos', photos)} error={errors.photos}
          status={{ uploaded: saved.uploaded, errors: photoErrors }} disabled={busy} />
      </Section>

      {step && (
        <View accessibilityLiveRegion="polite">
          <Notice tone="info">{stepLabel(step)}</Notice>
        </View>
      )}
      {formError && !busy ? <Notice tone="error">{formError}</Notice> : null}
      <Button label={draft ? 'Try publishing again' : 'Publish listing'} onPress={submit} busy={busy} />
      {draft && !busy && (
        <Button variant="secondary" label="Finish later" onPress={() => router.replace('/my-listings')} />
      )}
    </FormLayout>
  );
}

function Amenities({ selected, onToggle, disabled }: { selected: string[]; onToggle: (id: string) => void; disabled: boolean }) {
  const { rows, status, retry } = useAmenities();
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold">Amenities <ThemedText type="small" themeColor="textSecondary">(optional)</ThemedText></ThemedText>
      {status === 'loading' && <ThemedText type="small" themeColor="textSecondary">Loading amenities…</ThemedText>}
      {status === 'error' && (
        <View style={styles.chips}>
          <ThemedText type="small" themeColor="textSecondary">Couldn’t load amenities.</ThemedText>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.link}><ThemedText type="linkPrimary">Try again</ThemedText></Pressable>
        </View>
      )}
      {status === 'ready' && (
        <View style={styles.chips}>
          {rows.map((row) => <FilterChip key={row.id} label={row.name} selected={selected.includes(row.id)} onPress={() => !disabled && onToggle(row.id)} />)}
        </View>
      )}
    </View>
  );
}

function Checkbox({ label, checked, onPress, disabled }: { label: string; checked: boolean; onPress: () => void; disabled?: boolean }) {
  return <FilterChip label={label} selected={checked} onPress={() => !disabled && onPress()} />;
}

function FieldError({ message }: { message?: string }) {
  return message ? <ThemedText type="small" style={{ color: ERROR_COLOR }} accessibilityLiveRegion="polite">{message}</ThemedText> : null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">{title.toUpperCase()}</ThemedText>
      {children}
    </View>
  );
}

function FormLayout({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ThemedView style={styles.screen}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={[styles.content, {
        paddingTop: Platform.OS === 'web' ? Spacing.six + Spacing.three : insets.top + Spacing.four,
        paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
      }]}>
        <Pressable accessibilityRole="link" onPress={() => (router.canGoBack() ? router.back() : router.replace('/my-listings'))} style={styles.link}>
          <ThemedText type="linkPrimary">‹ My listings</ThemedText>
        </Pressable>
        <ThemedText type="subtitle" accessibilityRole="header">New listing</ThemedText>
        {children}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.three },
  group: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
