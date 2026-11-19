import { Stack } from 'expo-router';

// A deep link straight to a listing still has Browse underneath it, so Back returns to the feed.
export const unstable_settings = { anchor: 'index' };

/** The Browse tab's own stack: the feed, with listing details pushed on top (FR1, FR6). */
export default function BrowseLayout() {
  // Screens draw their own header and back link, so web (where the tab bar overlays the top) matches native.
  return <Stack screenOptions={{ headerShown: false }} />;
}
