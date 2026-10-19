// Admin: supplier list + add supplier.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { Badge, Button, Card, Chip, Icon, IconButton, Input, ModalSheet, Screen } from '../../components';
import { kg, peso } from '../../utils/format';
import { useBusy } from '../../hooks/useBusy';
import { colors, spacing } from '../../theme';

const EMPTY = { name: '', contactPerson: '', phone: '', email: '', address: '', leadTimeDays: '3', varietyIds: [] };

export default function SuppliersScreen() {
  const { state, actions, showToast } = useApp();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, run] = useBusy();
  const [errors, setErrors] = useState({});
  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleVariety = (productId) => {
    setForm((f) => ({
      ...f,
      varietyIds: f.varietyIds.includes(productId) ? f.varietyIds.filter((x) => x !== productId) : [...f.varietyIds, productId],
    }));
  };

  const save = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Supplier name is required.';
    if (!form.contactPerson.trim()) e.contactPerson = 'Contact person is required.';
    if (form.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a valid phone number.';
    if (!form.address.trim()) e.address = 'Address is required.';
    setErrors(e);
    if (Object.keys(e).length) return;
    run(async () => {
      const result = await actions.addSupplier({
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        leadTimeDays: Number(form.leadTimeDays) || 3,
        varietyIds: form.varietyIds,
      });
      if (!result.ok) {
        if (result.fields) setErrors(result.fields);
        return;
      }
      setAdding(false);
      setForm(EMPTY);
      showToast('Supplier added');
    });
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => <IconButton icon="plus" bg={colors.primary} color={colors.white} onPress={() => setAdding(true)} />,
        }}
      />

      {state.suppliers.map((s) => {
        const pos = state.purchaseOrders.filter((p) => p.supplierId === s.id && p.status !== 'cancelled');
        const spent = pos.reduce((sum, p) => sum + p.totalCost, 0);
        const delivered = pos.filter((p) => p.status === 'received').reduce((sum, p) => sum + p.totalKg, 0);
        const pending = pos.filter((p) => p.status === 'ordered').length;
        return (
          <Card key={s.id} onPress={() => router.push(`/admin/supplier/${s.id}`)} style={styles.card}>
            <View style={styles.top}>
              <View style={styles.icon}>
                <Icon name="truck-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.meta}>
                  {s.contactPerson} · {s.phone}
                </Text>
                <Text style={styles.meta}>{s.address}</Text>
              </View>
              {pending ? <Badge label={`${pending} pending`} tone="info" /> : null}
            </View>
            <View style={styles.varieties}>
              {s.varietyIds.map((id) => {
                const p = state.products.find((x) => x.id === id);
                return p ? <Badge key={id} label={p.name} tone="primary" icon="rice" /> : null;
              })}
            </View>
            <View style={styles.stats}>
              <Text style={styles.stat}>
                <Text style={styles.statStrong}>{pos.length}</Text> POs
              </Text>
              <Text style={styles.stat}>
                <Text style={styles.statStrong}>{kg(delivered)}</Text> delivered
              </Text>
              <Text style={styles.stat}>
                <Text style={styles.statStrong}>{peso(spent, 0)}</Text> total
              </Text>
            </View>
          </Card>
        );
      })}

      <Button title="Add Supplier" icon="plus" variant="outline" onPress={() => setAdding(true)} style={{ marginTop: spacing.sm }} />

      <ModalSheet visible={adding} title="New supplier" onClose={() => setAdding(false)} footer={<Button title="Save Supplier" icon="content-save-outline" onPress={save} loading={busy} />}>
        <Input label="Supplier / mill name" placeholder="e.g. Pangasinan Rice Mill" value={form.name} onChangeText={set('name')} error={errors.name} />
        <Input label="Contact person" value={form.contactPerson} onChangeText={set('contactPerson')} error={errors.contactPerson} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Input label="Phone" keyboardType="phone-pad" value={form.phone} onChangeText={set('phone')} error={errors.phone} style={{ flex: 1 }} />
          <Input label="Lead time (days)" keyboardType="number-pad" value={form.leadTimeDays} onChangeText={set('leadTimeDays')} style={{ flex: 1 }} />
        </View>
        <Input label="Email (optional)" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={set('email')} />
        <Input label="Address" value={form.address} onChangeText={set('address')} error={errors.address} />
        <Text style={styles.label}>Rice varieties they supply</Text>
        <View style={styles.varieties}>
          {state.products.map((p) => (
            <Chip key={p.id} label={p.name} selected={form.varietyIds.includes(p.id)} onPress={() => toggleVariety(p.id)} />
          ))}
        </View>
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  top: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15.5, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  varieties: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  stat: { fontSize: 12.5, color: colors.textMuted },
  statStrong: { fontWeight: '800', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
});
