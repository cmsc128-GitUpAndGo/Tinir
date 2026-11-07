import { useState } from 'react';

import { AuthScreen } from '@/components/auth-screen';
import { Button, Notice, TextField } from '@/components/form';
import { useResendVerification } from '@/hooks/use-resend-verification';

export default function ResendVerificationScreen() {
  const [email, setEmail] = useState('');
  const { resend, busy, remaining, result } = useResendVerification();
  return (
    <AuthScreen
      title="Resend verification"
      intro="Enter the email you registered with. If it still needs verification, we’ll send a new link."
      back={{ href: '/account', label: 'Back to account' }}>
      <TextField label="Email" value={email} onChangeText={setEmail} autoComplete="email" textContentType="emailAddress"
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={255} />
      {result && <Notice tone={result.tone}>{result.message}</Notice>}
      <Button
        label={remaining > 0 ? `Send again in ${remaining}s` : 'Send verification email'}
        busy={busy}
        disabled={remaining > 0 || !email.trim()}
        onPress={() => resend(email)}
      />
    </AuthScreen>
  );
}
