import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { CheckEmail } from '@/components/check-email';
import { Button, Choice, Notice, TextField } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { register, type RegistrationForm } from '@/services/auth';
import { backendError } from '@/services/errors';
import { validateRegistration, type FieldErrors } from '@/services/registration';

const empty: RegistrationForm = { role: null, full_name: '', email: '', password: '', contact_number: '', college_program: '' };

export default function RegisterScreen() {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState<string | null>(null);

  const set = <K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    // Clear a field's error as soon as the user edits it.
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async () => {
    setFormError(null);
    const checked = validateRegistration(form);
    if (!checked.ok) {
      setErrors(checked.fields);
      setFormError('Check the highlighted fields.');
      return;
    }
    setBusy(true);
    try {
      await register(form);
      setRegistered(checked.value.email);
      // Drop the password from memory once the account request is sent.
      setForm(empty);
    } catch (error) {
      const failure = backendError(error).error;
      setErrors(failure.fields ?? {});
      setFormError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  if (registered) {
    return (
      <AuthScreen title="Verify your email">
        <CheckEmail email={registered} />
      </AuthScreen>
    );
  }

  const owner = form.role === 'owner';
  return (
    <AuthScreen title="Create an account" intro="Browse freely. An account lets students send inquiries and owners post listings.">
      <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Account type">
        <ThemedText type="smallBold">I am a…</ThemedText>
        <Choice label="Student" description="Find a place and contact owners." selected={form.role === 'student'} onPress={() => set('role', 'student')} />
        <Choice label="Property Owner" description="List bedspaces, rooms, or apartments." selected={owner} onPress={() => set('role', 'owner')} />
        {errors.role ? <Notice tone="error">{errors.role}</Notice> : null}
      </View>

      <View style={styles.group}>
        <TextField label="Full name" value={form.full_name} onChangeText={(v) => set('full_name', v)} error={errors.full_name}
          autoComplete="name" textContentType="name" autoCapitalize="words" maxLength={120} />
        <TextField label="Email" value={form.email} onChangeText={(v) => set('email', v)} error={errors.email}
          autoComplete="email" textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={255} />
        <TextField label="Password" value={form.password} onChangeText={(v) => set('password', v)} error={errors.password} secret
          hint="At least 8 characters with a letter and a number." autoComplete="new-password" textContentType="newPassword"
          autoCapitalize="none" autoCorrect={false} maxLength={128} />
        <TextField label="Contact number" value={form.contact_number} onChangeText={(v) => set('contact_number', v)} error={errors.contact_number}
          optional={!owner} hint={owner ? 'Shown to logged-in users on your listings.' : undefined}
          autoComplete="tel" textContentType="telephoneNumber" keyboardType="phone-pad" maxLength={20} />
        {form.role === 'student' && (
          <TextField label="College / program" value={form.college_program} onChangeText={(v) => set('college_program', v)}
            error={errors.college_program} optional placeholder="e.g. BS Computer Science" maxLength={120} />
        )}
      </View>

      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button label="Create account" onPress={submit} busy={busy} />
      <ThemedText type="small" themeColor="textSecondary">
        Didn’t get a verification email?{' '}
        <Link href="/auth/resend"><ThemedText type="linkPrimary">Resend it</ThemedText></Link>
      </ThemedText>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({ group: { gap: Spacing.three } });
