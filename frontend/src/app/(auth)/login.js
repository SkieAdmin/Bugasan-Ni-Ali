import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { Button, Card, Icon, Input } from '../../components';
import { useBusy } from '../../hooks/useBusy';
import { colors, font, radius, spacing } from '../../theme';

export default function LoginScreen() {
  const { state, actions } = useApp();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, run] = useBusy();

  const submit = () =>
    run(async () => {
      if (!email.trim() || !password) {
        setError('Please enter your email and password.');
        return;
      }
      const result = await actions.login(email, password);
      if (!result.ok) setError(result.error);
      // On success the (auth) layout redirects to the right home screen.
    });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.hero, { paddingTop: insets.top + 36 }]}>
        <View style={styles.logo}>
          <Icon name="rice" size={42} color={colors.primary} />
        </View>
        <Text style={styles.brand}>{state.store.name}</Text>
        <Text style={styles.tagline}>{state.store.tagline}</Text>
      </View>

      <View style={styles.body}>
        <Card style={styles.formCard}>
          <Text style={font.h2}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to order rice or manage the store.</Text>

          <Input
            label="Email"
            icon="email-outline"
            placeholder="you@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setError('');
            }}
          />
          <Input
            label="Password"
            icon="lock-outline"
            placeholder="Your password"
            secure
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError('');
            }}
            onSubmitEditing={submit}
          />

          {error ? (
            <View style={styles.error}>
              <Icon name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button title="Log In" icon="login" onPress={submit} loading={busy} />

          <View style={styles.registerRow}>
            <Text style={styles.muted}>New customer?</Text>
            <Link href="/register" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.link}>Create an account</Text>
              </Pressable>
            </Link>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingBottom: 64,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  brand: { fontSize: 28, fontWeight: '900', color: colors.white },
  tagline: { fontSize: 14, color: '#CFE6D9', marginTop: 4 },
  body: { paddingHorizontal: spacing.lg, marginTop: -40, width: '100%', maxWidth: 520, alignSelf: 'center' },
  formCard: { padding: spacing.xl },
  subtitle: { ...font.body, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
  error: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '600', flex: 1 },
  registerRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.lg },
  muted: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
