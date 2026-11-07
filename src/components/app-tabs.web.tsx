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
import { Pressable, View, StyleSheet } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useViewer } from '@/lib/viewer-provider';
import { visibleAreas, type Area } from '@/services/access';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

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
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton hidden={!shown.has(tab.area)}>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, hidden, ref: _triggerRef, ...props }: TabTriggerSlotProps & { hidden?: boolean }) {
  if (hidden) return null;
  return (
    <Pressable {...props} ref={_triggerRef as Ref<ComponentRef<typeof Pressable>>} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          Tinir
        </ThemedText>

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
});
