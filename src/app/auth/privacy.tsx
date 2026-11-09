import { StyleSheet, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Privacy notice and terms shown during registration (REQUIREMENTS §6, NFR7). Not a claim of legal certification. */
export default function PrivacyScreen() {
  return (
    <AuthScreen
      title="Privacy notice and terms"
      intro="What Tinir collects when you register, why, and who can see it."
      back={{ href: '/auth/register', label: 'Back to registration' }}>
      <Section title="What we collect">
        <Item>Your full name, email address, and password. The password is stored only as a secure hash by our sign-in provider.</Item>
        <Item>Whether you are a Student or a Property Owner.</Item>
        <Item>A contact number: required for property owners, optional for students.</Item>
        <Item>Your college or program: optional, and only for students.</Item>
      </Section>

      <Section title="Why we collect it">
        <Item>To verify your email and keep your account secure.</Item>
        <Item>To let students contact property owners about listings.</Item>
        <Item>To let owners manage their own listings and the inquiries sent to them.</Item>
      </Section>

      <Section title="Who can see it">
        <Item>
          Property owners: your name, contact number, and email are shown on your listings to logged-in users only, never to
          guests.
        </Item>
        <Item>An inquiry you send is visible only to you and the owner of that listing.</Item>
        <Item>Your password is never shown to anyone, and other details are not shared outside Tinir.</Item>
      </Section>

      <Section title="Terms">
        <Item>Give accurate information, and keep your contact number current.</Item>
        <Item>Owners may list only places they are allowed to rent out, with honest details and availability.</Item>
        <Item>
          Tinir helps students and owners find each other. It does not handle rent, deposits, or contracts; those are
          agreed directly between students and owners.
        </Item>
      </Section>

      <ThemedText type="small" themeColor="textSecondary">
        Tinir aims to follow the Philippine Data Privacy Act of 2012 (RA 10173) by collecting only what it needs. This notice
        is not a claim of legal certification.
      </ThemedText>
    </AuthScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.item}>
      <ThemedText type="small" aria-hidden>
        •
      </ThemedText>
      <ThemedText type="small" style={styles.itemText}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  item: { flexDirection: 'row', gap: Spacing.two },
  itemText: { flex: 1 },
});
