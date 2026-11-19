import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ACCENT = '#208AEF';

/** A toggle chip for search filters. `role` says whether it is one choice of several or an independent option. */
export function FilterChip({ label, selected, onPress, role = 'checkbox' }: {
  label: string; selected: boolean; onPress: () => void; role?: 'checkbox' | 'radio';
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement, borderColor: selected ? ACCENT : 'transparent' },
        pressed && styles.pressed,
      ]}>
      <ThemedText type={selected ? 'smallBold' : 'small'}>{selected ? `✓ ${label}` : label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Spacing.four, borderWidth: 2, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
