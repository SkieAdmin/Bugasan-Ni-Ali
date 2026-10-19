// Admin: add a new rice variety to the catalog.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { Button, ChipRow, Icon, Input, RiceThumb, Screen, SectionHeader } from '../../../components';
import { useBusy } from '../../../hooks/useBusy';
import { colors, spacing } from '../../../theme';

const TINTS = ['#B7862B', '#3F8F6B', '#8C6D3F', '#6E8B3D', '#A65E3A', '#8E6BA8', '#B23A3A', '#2A6FB0'];

export default function NewProductScreen() {
  const { state, actions, showToast } = useApp();
  const [busy, run] = useBusy();
  const [form, setForm] = useState({
    name: '',
    category: state.categories[0] || 'Premium',
    origin: '',
    description: '',
    retailPrice: '',
    wholesalePrice: '',
    costPerKg: '',
    stockKg: '0',
    reorderLevel: '200',
    supplierId: state.suppliers[0]?.id,
    tint: TINTS[0],
  });
  const [errors, setErrors] = useState({});
  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = () => {
    const e = {};
    const num = (k) => Number(form[k]);
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.origin.trim()) e.origin = 'Origin is required.';
    ['retailPrice', 'wholesalePrice', 'costPerKg'].forEach((k) => {
      if (!(num(k) > 0)) e[k] = 'Enter a price.';
    });
    if (num('wholesalePrice') > num('retailPrice')) e.wholesalePrice = 'Must not be higher than retail.';
    if (!(num('stockKg') >= 0)) e.stockKg = 'Enter 0 or more.';
    if (!(num('reorderLevel') >= 0)) e.reorderLevel = 'Enter 0 or more.';
    setErrors(e);
    if (Object.keys(e).length) return;

    run(async () => {
      const result = await actions.addProduct({
        name: form.name.trim(),
        category: form.category,
        origin: form.origin.trim(),
        description: form.description.trim() || `${form.name.trim()} rice from ${form.origin.trim()}.`,
        retailPrice: num('retailPrice'),
        wholesalePrice: num('wholesalePrice'),
        costPerKg: num('costPerKg'),
        stockKg: num('stockKg'),
        reorderLevel: num('reorderLevel'),
        supplierId: form.supplierId || null,
        tint: form.tint,
      });
      if (!result.ok) {
        if (result.fields) setErrors(result.fields);
        return;
      }
      showToast(`${result.product.name} added to the catalog`);
      router.replace(`/admin/product/${result.product.id}`);
    });
  };

  return (
    <Screen footer={<Button title="Save Rice Variety" icon="content-save-outline" onPress={save} loading={busy} />}>
      <View style={styles.preview}>
        <RiceThumb product={{ tint: form.tint }} size={72} />
        <View style={styles.tints}>
          {TINTS.map((t) => (
            <Pressable key={t} onPress={() => set('tint')(t)} style={[styles.tint, { backgroundColor: t }]}>
              {form.tint === t ? <Icon name="check" size={16} color={colors.white} /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      <Input label="Variety name" placeholder="e.g. Ifugao Tinawon" value={form.name} onChangeText={set('name')} error={errors.name} />
      <Text style={styles.label}>Category</Text>
      <ChipRow options={state.categories.map((c) => ({ value: c, label: c }))} value={form.category} onChange={set('category')} style={{ marginBottom: spacing.md }} />
      <Input label="Origin" placeholder="Province or country" value={form.origin} onChangeText={set('origin')} error={errors.origin} />
      <Input label="Description" placeholder="Taste, texture, best use…" value={form.description} onChangeText={set('description')} multiline />

      <SectionHeader title="Pricing (per kilo)" style={{ marginTop: spacing.sm }} />
      <View style={styles.row}>
        <Input label="Retail (₱)" keyboardType="decimal-pad" value={form.retailPrice} onChangeText={set('retailPrice')} error={errors.retailPrice} style={styles.flex} />
        <Input label="Wholesale (₱)" keyboardType="decimal-pad" value={form.wholesalePrice} onChangeText={set('wholesalePrice')} error={errors.wholesalePrice} style={styles.flex} />
        <Input label="Cost (₱)" keyboardType="decimal-pad" value={form.costPerKg} onChangeText={set('costPerKg')} error={errors.costPerKg} style={styles.flex} />
      </View>

      <SectionHeader title="Stock" style={{ marginTop: spacing.sm }} />
      <View style={styles.row}>
        <Input label="Opening stock (kg)" keyboardType="number-pad" value={form.stockKg} onChangeText={set('stockKg')} error={errors.stockKg} style={styles.flex} />
        <Input label="Reorder level (kg)" keyboardType="number-pad" value={form.reorderLevel} onChangeText={set('reorderLevel')} error={errors.reorderLevel} style={styles.flex} />
      </View>

      <Text style={styles.label}>Main supplier</Text>
      <ChipRow options={state.suppliers.map((s) => ({ value: s.id, label: s.name }))} value={form.supplierId} onChange={set('supplierId')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg },
  tints: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tint: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
