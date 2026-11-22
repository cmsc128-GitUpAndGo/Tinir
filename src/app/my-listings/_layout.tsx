import { Stack } from 'expo-router';

// A deep link straight to the new-listing form still has My listings underneath it.
export const unstable_settings = { anchor: 'index' };

/** The My listings tab's own stack: the owner's listings, with the new-listing form pushed on top (FR9). */
export default function MyListingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
