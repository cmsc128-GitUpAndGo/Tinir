import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useViewer } from '@/lib/viewer-provider';
import { visibleAreas } from '@/services/access';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  // Each role gets its own tab set (FR5). Hidden tabs cannot be reached at all; screens still gate themselves.
  const shown = new Set(visibleAreas(useViewer().viewer));

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Browse</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="saved" hidden={!shown.has('saved')}>
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bookmark" md="bookmark" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="my-listings" hidden={!shown.has('my-listings')}>
        <NativeTabs.Trigger.Label>My listings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home_work" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inquiries" hidden={!shown.has('inquiries')}>
        <NativeTabs.Trigger.Label>Inquiries</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right" md="forum" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
