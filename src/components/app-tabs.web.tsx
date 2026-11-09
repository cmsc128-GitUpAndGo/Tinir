import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import type { Href } from 'expo-router';
import type { ComponentRef, Ref } from 'react';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useViewer } from '@/lib/viewer-provider';
import { visibleAreas, type Area } from '@/services/access';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/** Below this width the tab row drops the brand and splits the width evenly, so it fits 360px phones (NFR2). */
export const COMPACT_TABS_BELOW = 600;

const TABS: { area: Area; name: string; href: Href; label: string }[] = [
  { area: 'browse', name: 'home', href: '/', label: 'Browse' },
  { area: 'saved', name: 'saved', href: '/saved', label: 'Saved' },
  { area: 'my-listings', name: 'my-listings', href: '/my-listings', label: 'My listings' },
  { area: 'inquiries', name: 'inquiries', href: '/inquiries', label: 'Inquiries' },
  { area: 'account', name: 'account', href: '/account', label: 'Account' },
];

export default function AppTabs() {
  // Each role sees its own tabs (FR5). Every route stays registered so a typed URL reaches the screen,
  // whose role gate then asks a guest to log in or tells a wrong role the page is not for them.
  const shown = new Set(visibleAreas(useViewer().viewer));
  const compact = useWindowDimensions().width < COMPACT_TABS_BELOW;
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList compact={compact}>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton hidden={!shown.has(tab.area)} compact={compact}>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  hidden,
  compact,
  ref: _triggerRef,
  ...props
}: TabTriggerSlotProps & { hidden?: boolean; compact?: boolean }) {
  if (hidden) return null;
  return (
    <Pressable
      {...props}
      ref={_triggerRef as Ref<ComponentRef<typeof Pressable>>}
      style={({ pressed }) => [compact && styles.compactTab, pressed && styles.pressed]}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.tabButtonView, compact && styles.compactTabView]}>
        <ThemedText
          type="small"
          themeColor={isFocused ? 'text' : 'textSecondary'}
          style={compact && styles.compactLabel}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList({ compact, ...props }: TabListProps & { compact?: boolean }) {
  return (
    <View {...props} style={[styles.tabListContainer, compact && styles.compactListContainer]}>
      <ThemedView type="backgroundElement" style={[styles.innerContainer, compact && styles.compactInner]}>
        {!compact && (
          <ThemedText type="smallBold" style={styles.brandText}>
            Tinir
          </ThemedText>
        )}

        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  // Compact: equal-width tabs that may shrink, labels that wrap instead of clipping, 44px touch targets.
  compactListContainer: {
    padding: Spacing.two,
  },
  compactInner: {
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
    gap: Spacing.one,
  },
  compactTab: {
    flex: 1,
    minWidth: 0,
  },
  compactTabView: {
    minHeight: 44,
    paddingHorizontal: Spacing.one,
    justifyContent: 'center',
  },
  compactLabel: {
    textAlign: 'center',
  },
});
