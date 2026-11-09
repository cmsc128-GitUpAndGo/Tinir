import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const ERROR_COLOR = '#D92D20';
const ACCENT = '#208AEF';

type FieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  /** Adds a Show/Hide toggle for password fields. */
  secret?: boolean;
};

export function TextField({ label, error, hint, optional, secret, ...input }: FieldProps) {
  const theme = useTheme();
  const [hidden, setHidden] = useState(true);
  const describedBy = error ?? hint;
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" nativeID={`${label}-label`}>
        {label}
        {optional ? <ThemedText type="small" themeColor="textSecondary"> (optional)</ThemedText> : null}
      </ThemedText>
      <View style={styles.inputRow}>
        <TextInput
          {...input}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${label}-label`}
          accessibilityHint={describedBy}
          aria-invalid={Boolean(error)}
          secureTextEntry={secret ? hidden : input.secureTextEntry}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: error ? ERROR_COLOR : theme.backgroundSelected },
          ]}
        />
        {secret && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((value) => !value)}
            style={styles.toggle}
            hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">{hidden ? 'Show' : 'Hide'}</ThemedText>
          </Pressable>
        )}
      </View>
      {error ? (
        <ThemedText type="small" style={{ color: ERROR_COLOR }} accessibilityLiveRegion="polite">{error}</ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText>
      ) : null}
    </View>
  );
}

export function Choice({ label, description, selected, onPress }: {
  label: string; description: string; selected: boolean; onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}. ${description}`}
      onPress={onPress}
      style={[
        styles.choice,
        { backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement, borderColor: selected ? ACCENT : 'transparent' },
      ]}>
      <View style={[styles.radio, { borderColor: selected ? ACCENT : theme.textSecondary }]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <View style={styles.choiceText}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{description}</ThemedText>
      </View>
    </Pressable>
  );
}

export function Button({ label, onPress, busy, disabled, variant = 'primary' }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean; variant?: 'primary' | 'secondary';
}) {
  const theme = useTheme();
  const inactive = busy || disabled;
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(busy) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? ACCENT : theme.backgroundSelected },
        (pressed || inactive) && styles.dimmed,
      ]}>
      {busy ? <ActivityIndicator color={primary ? '#ffffff' : theme.text} /> : null}
      <ThemedText type="smallBold" style={primary ? styles.primaryText : undefined}>{label}</ThemedText>
    </Pressable>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const theme = useTheme();
  const border = tone === 'error' ? ERROR_COLOR : tone === 'success' ? '#079455' : ACCENT;
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={[styles.notice, { backgroundColor: theme.backgroundElement, borderLeftColor: border }]}>
      {typeof children === 'string' ? <ThemedText type="small">{children}</ThemedText> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  inputRow: { justifyContent: 'center' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, fontSize: 16 },
  toggle: { position: 'absolute', right: Spacing.three, minHeight: 44, justifyContent: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.three, borderWidth: 2, minHeight: 64 },
  choiceText: { flex: 1, gap: Spacing.half },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ACCENT },
  button: { minHeight: 48, borderRadius: Spacing.three, paddingHorizontal: Spacing.four, flexDirection: 'row', gap: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#ffffff' },
  dimmed: { opacity: 0.6 },
  notice: { borderLeftWidth: 4, borderRadius: Spacing.two, padding: Spacing.three, gap: Spacing.one },
});
