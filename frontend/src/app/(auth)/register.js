import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { Button, Icon, IconButton, Input, Screen } from '../../components';
import { useBusy } from '../../hooks/useBusy';
import { colors, font, radius, spacing } from '../../theme';

const ACCOUNT_TYPES = [
  {
    value: 'retail',
    icon: 'home-heart',
    title: 'Household',
    text: 'Buy rice for your family at retail prices.',
  },
  {
    value: 'wholesale',
    icon: 'store',
    title: 'Business / Reseller',
    text: 'Sari-sari stores, carinderias and resellers. Wholesale prices after approval.',
  },
];

export default function RegisterScreen() {
  const { actions } = useApp();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    confirm: '',
    accountType: 'retail',
    businessName: '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, run] = useBusy();

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setFormError('');
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a valid mobile number.';
    if (!form.address.trim()) e.address = 'Address is needed for deliveries.';
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters.';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    if (form.accountType === 'wholesale' && !form.businessName.trim()) e.businessName = 'Business name is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const submit = () =>
    run(async () => {
      if (!validate()) return;
      const result = await actions.register(form);
      if (!result.ok) {
        setFormError(result.error);
        if (result.fields) setErrors(result.fields);
      }
      // On success the (auth) layout redirects to the shop.
    });

  return (
    <Screen safeTop>
      <IconButton icon="arrow-left" onPress={goBack} style={{ marginBottom: spacing.md }} />
      <Text style={font.h1}>Create your account</Text>
      <Text style={styles.subtitle}>Order rice by kilo, sack or bulk — for pickup or delivery.</Text>

      <Text style={styles.label}>I am buying for a…</Text>
      <View style={styles.typeRow}>
        {ACCOUNT_TYPES.map((t) => {
          const active = form.accountType === t.value;
          return (
            <Pressable key={t.value} onPress={() => set('accountType')(t.value)} style={[styles.type, active && styles.typeActive]}>
              <View style={styles.typeTop}>
                <Icon name={t.icon} size={24} color={active ? colors.primary : colors.textMuted} />
                <Icon
                  name={active ? 'radiobox-marked' : 'radiobox-blank'}
                  size={20}
                  color={active ? colors.primary : colors.border}
                />
              </View>
              <Text style={[styles.typeTitle, active && { color: colors.primaryDark }]}>{t.title}</Text>
              <Text style={styles.typeText}>{t.text}</Text>
            </Pressable>
          );
        })}
      </View>

      {form.accountType === 'wholesale' ? (
        <>
          <Input
            label="Business name"
            icon="store-outline"
            placeholder="e.g. Aling Nena Sari-Sari Store"
            value={form.businessName}
            onChangeText={set('businessName')}
            error={errors.businessName}
          />
          <View style={styles.note}>
            <Icon name="information-outline" size={18} color={colors.info} />
            <Text style={styles.noteText}>
              The store will review your wholesale account. You can order right away at retail prices while waiting.
            </Text>
          </View>
        </>
      ) : null}

      <Input label="Full name" icon="account-outline" placeholder="Juan Dela Cruz" value={form.name} onChangeText={set('name')} error={errors.name} />
      <Input
        label="Email"
        icon="email-outline"
        placeholder="you@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={form.email}
        onChangeText={set('email')}
        error={errors.email}
      />
      <Input
        label="Mobile number"
        icon="phone-outline"
        placeholder="0917 123 4567"
        keyboardType="phone-pad"
        value={form.phone}
        onChangeText={set('phone')}
        error={errors.phone}
      />
      <Input
        label="Delivery address"
        icon="map-marker-outline"
        placeholder="House no., street, barangay"
        value={form.address}
        onChangeText={set('address')}
        error={errors.address}
      />
      <Input label="Password" icon="lock-outline" placeholder="At least 6 characters" secure value={form.password} onChangeText={set('password')} error={errors.password} />
      <Input label="Confirm password" icon="lock-check-outline" placeholder="Type it again" secure value={form.confirm} onChangeText={set('confirm')} error={errors.confirm} />

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <Button title="Create Account" icon="account-plus" onPress={submit} loading={busy} style={{ marginTop: spacing.sm }} />
      <Button title="I already have an account" variant="ghost" onPress={goBack} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...font.body, color: colors.textMuted, marginTop: 4, marginBottom: spacing.xl },
  label: { ...font.label, marginBottom: spacing.sm },
  typeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  type: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  typeActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  typeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeTitle: { fontSize: 14.5, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  typeText: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.infoLight,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
  noteText: { flex: 1, fontSize: 12.5, color: colors.info, lineHeight: 18 },
  formError: { color: colors.danger, fontWeight: '600', marginBottom: spacing.sm, textAlign: 'center' },
});
