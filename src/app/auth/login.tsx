import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { Button, Notice, TextField } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useResendVerification } from '@/hooks/use-resend-verification';
import { useSession } from '@/lib/supabase/session-provider';
import { login, type LoginForm } from '@/services/auth';
import { backendError } from '@/services/errors';
import { validateLogin, type LoginFields } from '@/services/login';

const empty: LoginForm = { email: '', password: '' };

export default function LoginScreen() {
  const { session, loading } = useSession();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<LoginFields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resend = useResendVerification();

  const set = (key: keyof LoginForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async () => {
    setFormError(null);
    setUnverified(null);
    const checked = validateLogin(form);
    if (!checked.ok) { setErrors(checked.fields); return; }
    setBusy(true);
    try {
      await login(form);
      // Drop the password from memory once the session exists.
      setForm(empty);
      router.replace('/account');
    } catch (error) {
      const failure = backendError(error).error;
      setErrors(failure.fields ?? {});
      setFormError(failure.message);
      if (failure.code === 'EMAIL_UNVERIFIED') setUnverified(checked.value.email);
    } finally {
      setBusy(false);
    }
  };

  // Someone already logged in (for example after a verification link) goes straight to their account.
  if (!loading && session) return <Redirect href="/account" />;

  return (
    <AuthScreen title="Log in" intro="Welcome back. Log in to send inquiries, save listings, or manage your listings.">
      <View style={styles.group}>
        <TextField label="Email" value={form.email} onChangeText={(v) => set('email', v)} error={errors.email}
          autoComplete="email" textContentType="username" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          maxLength={255} />
        <TextField label="Password" value={form.password} onChangeText={(v) => set('password', v)} error={errors.password} secret
          autoComplete="current-password" textContentType="password" autoCapitalize="none" autoCorrect={false} maxLength={128}
          onSubmitEditing={submit} returnKeyType="go" />
      </View>

      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {unverified ? (
        <>
          {resend.result && <Notice tone={resend.result.tone}>{resend.result.message}</Notice>}
          <Button variant="secondary" label={resend.remaining > 0 ? `Resend in ${resend.remaining}s` : 'Resend verification email'}
            busy={resend.busy} disabled={resend.remaining > 0} onPress={() => resend.resend(unverified)} />
        </>
      ) : null}
      <Button label="Log in" onPress={submit} busy={busy} />
      <ThemedText type="small" themeColor="textSecondary">
        New to Tinir?{' '}
        <Link href="/auth/register" replace><ThemedText type="linkPrimary">Create an account</ThemedText></Link>
      </ThemedText>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({ group: { gap: Spacing.three } });
