// Admin: record a new purchase order to a supplier (restocking).
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import {
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  IconButton,
  InfoRow,
  Input,
  QuantityStepper,
  RiceThumb,
  Screen,
  SectionHeader,
} from '../../../components';
import { addDays, formatDayLabel, kg, peso, startOfDay } from '../../../utils/format';
import { useBusy } from '../../../hooks/useBusy';
import { colors, radius, spacing } from '../../../theme';

const nextDays = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i + 1));

export default function NewPurchaseOrderScreen() {
  const params = useLocalSearchParams();
  const { state, actions, showToast } = useApp();
  const [busy, run] = useBusy();

  const initial = useMemo(() => {
    const product = state.products.find((p) => p.id === params.productId);
    const supplierId = params.supplierId || product?.supplierId || state.suppliers[0]?.id;
    const lines = product
      ? [
          {
            productId: product.id,
            sacks: Math.max(1, Math.ceil((product.reorderLevel * 3 - product.stockKg) / 50)),
            costPerKg: String(product.costPerKg),
          },
        ]
      : [];
    return { supplierId, lines };
    // Only on first open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [supplierId, setSupplierId] = useState(initial.supplierId);
  const [lines, setLines] = useState(initial.lines);
  const supplier = state.suppliers.find((s) => s.id === supplierId);
  const [dayIndex, setDayIndex] = useState(Math.max(0, (supplier?.leadTimeDays || 3) - 1));
  const [notes, setNotes] = useState('');

  if (!state.suppliers.length) {
    return <EmptyState icon="truck-outline" title="Add a supplier first" action="Go to Suppliers" onAction={() => router.replace('/admin/suppliers')} />;
  }

  const chooseSupplier = (id) => {
    setSupplierId(id);
    const s = state.suppliers.find((x) => x.id === id);
    setDayIndex(Math.max(0, (s?.leadTimeDays || 3) - 1));
  };

  const addLine = (productId) => {
    const product = state.products.find((p) => p.id === productId);
    setLines((ls) => [...ls, { productId, sacks: 10, costPerKg: String(product.costPerKg) }]);
  };

  const updateLine = (productId, changes) => setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, ...changes } : l)));
  const removeLine = (productId) => setLines((ls) => ls.filter((l) => l.productId !== productId));

  const available = state.products
    .filter((p) => !lines.some((l) => l.productId === p.id))
    .sort((a, b) => (supplier?.varietyIds.includes(b.id) ? 1 : 0) - (supplier?.varietyIds.includes(a.id) ? 1 : 0));

  const totalKg = lines.reduce((s, l) => s + l.sacks * 50, 0);
  const totalCost = lines.reduce((s, l) => s + l.sacks * 50 * (Number(l.costPerKg) || 0), 0);

  const save = () => {
    if (!lines.length) {
      showToast('Add at least one rice variety', 'error');
      return;
    }
    if (lines.some((l) => !(Number(l.costPerKg) > 0))) {
      showToast('Enter the cost per kg for every item', 'error');
      return;
    }
    run(async () => {
      const result = await actions.createPurchaseOrder({
        supplierId,
        items: lines.map((l) => ({ productId: l.productId, sacks: l.sacks, costPerKg: Number(l.costPerKg) })),
        expectedAt: nextDays[dayIndex].toISOString(),
        notes: notes.trim(),
      });
      if (!result.ok) return;
      showToast(`${result.po.id} recorded`);
      router.replace(`/admin/purchase-order/${result.po.id}`);
    });
  };

  return (
    <Screen footer={<Button title={`Save Purchase Order · ${peso(totalCost, 0)}`} icon="content-save-outline" onPress={save} disabled={!lines.length} loading={busy} />}>
      <SectionHeader title="Supplier" style={{ marginTop: 0 }} />
      <ChipRow options={state.suppliers.map((s) => ({ value: s.id, label: s.name, icon: 'truck-outline' }))} value={supplierId} onChange={chooseSupplier} />

      <SectionHeader title="Rice to order" />
      {lines.length === 0 ? <Text style={styles.hint}>Pick the rice varieties below to add them to this purchase order.</Text> : null}
      {lines.map((l) => {
        const product = state.products.find((p) => p.id === l.productId);
        return (
          <Card key={l.productId} style={styles.line}>
            <View style={styles.lineTop}>
              <RiceThumb product={product} size={42} />
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{product.name}</Text>
                <Text style={styles.lineSub}>In stock: {kg(product.stockKg)}</Text>
              </View>
              <IconButton icon="close" size={18} bg={colors.divider} color={colors.textSecondary} onPress={() => removeLine(l.productId)} />
            </View>
            <View style={styles.lineBottom}>
              <View>
                <Text style={styles.small}>Sacks (50 kg)</Text>
                <QuantityStepper value={l.sacks} onChange={(v) => updateLine(l.productId, { sacks: v })} size="sm" max={500} />
              </View>
              <Input
                label="Cost / kg (₱)"
                keyboardType="decimal-pad"
                value={l.costPerKg}
                onChangeText={(t) => updateLine(l.productId, { costPerKg: t })}
                style={{ flex: 1, marginBottom: 0 }}
              />
            </View>
            <Text style={styles.lineTotal}>
              {kg(l.sacks * 50)} · {peso(l.sacks * 50 * (Number(l.costPerKg) || 0))}
            </Text>
          </Card>
        );
      })}

      {available.length ? (
        <>
          <Text style={styles.addLabel}>Add rice variety</Text>
          <View style={styles.addChips}>
            {available.map((p) => (
              <Chip key={p.id} label={p.name} icon={supplier?.varietyIds.includes(p.id) ? 'star-outline' : 'plus'} onPress={() => addLine(p.id)} />
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Expected delivery" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {nextDays.map((d, i) => {
          const label = formatDayLabel(d);
          const active = i === dayIndex;
          return (
            <Pressable key={d.toISOString()} onPress={() => setDayIndex(i)} style={[styles.day, active && styles.dayActive]}>
              <Text style={[styles.dayName, active && styles.dayActiveText]}>{label.day}</Text>
              <Text style={[styles.dayDate, active && styles.dayActiveText]}>{label.date}</Text>
              <Text style={[styles.dayName, active && styles.dayActiveText]}>{label.month}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {supplier ? <Text style={styles.hint}>{supplier.name} usually delivers in {supplier.leadTimeDays} days.</Text> : null}

      <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline style={{ marginTop: spacing.lg }} />

      <Card>
        <InfoRow label="Total sacks" value={String(totalKg / 50)} />
        <InfoRow label="Total weight" value={kg(totalKg)} />
        <InfoRow label="Total cost" value={peso(totalCost)} bold />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12.5, color: colors.textMuted, marginTop: spacing.sm },
  line: { marginBottom: spacing.md },
  lineTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lineName: { fontSize: 15, fontWeight: '700', color: colors.text },
  lineSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  lineBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: spacing.md },
  small: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  lineTotal: { fontSize: 13, fontWeight: '700', color: colors.primaryDark, marginTop: spacing.md, textAlign: 'right' },
  addLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.sm },
  addChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  day: {
    width: 58,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayName: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  dayDate: { fontSize: 18, fontWeight: '800', color: colors.text },
  dayActiveText: { color: colors.white },
});
