import { StyleSheet, View } from 'react-native';

import { Button, Notice } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useResendVerification } from '@/hooks/use-resend-verification';
import type { SignupDelivery } from '@/services/registration';

/**
 * Pending-verification panel shown after signup (FR3). The address is only kept in memory. `unconfirmed`
 * means Auth throttled email, so the panel makes no claim that a link was sent (NFR12).
 */
export function CheckEmail({ email, delivery = 'sent' }: { email: string; delivery?: SignupDelivery }) {
  const { resend, busy, remaining, result } = useResendVerification(true);
  return (
    <View style={styles.panel}>
      {delivery === 'sent' ? (
        <Notice tone="success">
          <ThemedText type="smallBold">Check your email to verify your account.</ThemedText>
          <ThemedText type="small">
            We sent a verification link to {email}. Open it on this device to finish; it expires after 24 hours.
            No email? Check spam, or resend below. An address that already has an account gets no new link.
          </ThemedText>
        </Notice>
      ) : (
        <Notice tone="info">
          <ThemedText type="smallBold">Your registration was received, but we couldn’t confirm the email went out.</ThemedText>
          <ThemedText type="small">
            Verification emails are busy right now. If no link reaches {email} in a few minutes, check spam, then
            resend below. An address that already has an account gets no new link.
          </ThemedText>
        </Notice>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        Until you verify, you can browse listings but can’t send inquiries, save listings, or post listings.
      </ThemedText>
      {result && <Notice tone={result.tone}>{result.message}</Notice>}
      <Button
        variant="secondary"
        label={remaining > 0 ? `Resend email in ${remaining}s` : 'Resend verification email'}
        busy={busy}
        disabled={remaining > 0}
        onPress={() => resend(email)}
      />
    </View>
  );
}

const styles = StyleSheet.create({ panel: { gap: Spacing.three } });
