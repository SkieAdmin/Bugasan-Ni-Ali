// Admin: stock, prices and stock-movement history of one rice variety.
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import {
  Button,
  Card,
  ChipRow,
  EmptyState,
  Icon,
  InfoRow,
  Input,
  ModalSheet,
  RiceThumb,
  Screen,
  SectionHeader,
  Segmented,
  StockBadge,
} from '../../../components';
import { formatDateTime, kg, peso, sacks } from '../../../utils/format';
import { useApiData } from '../../../hooks/useApiData';
import { useBusy } from '../../../hooks/useBusy';
import { colors, radius, spacing } from '../../../theme';

const MOVEMENT = {
  sale: { label: 'Sale', icon: 'cart-arrow-right' },
  restock: { label: 'Restock', icon: 'truck-delivery-outline' },
  return: { label: 'Returned', icon: 'undo-variant' },
  adjustment: { label: 'Adjustment', icon: 'scale-balance' },
};

const REASONS = ['Physical count correction', 'Damaged / spoiled', 'Returned by customer', 'Used as sample'];

export default function ProductAdminScreen() {
  const { id } = useLocalSearchParams();
  const { state, actions, showToast } = useApp();
  const product = state.products.find((p) => p.id === id);
  const [prices, setPrices] = useState(() =>
    product
      ? {
          retailPrice: String(product.retailPrice),
          wholesalePrice: String(product.wholesalePrice),
          costPerKg: String(product.costPerKg),
          reorderLevel: String(product.reorderLevel),
        }
      : {}
  );
  const [adjusting, setAdjusting] = useState(false);
  const [direction, setDirection] = useState('add');
  const [adjustKg, setAdjustKg] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [showAll, setShowAll] = useState(false);
  const [busy, run] = useBusy();
  // Stock history and 30-day sales come from the server (all orders, not just the loaded ones).
  const history = useApiData(`/products/${id}/movements`);

  if (!product) return <EmptyState title="Rice variety not found" />;

  const supplier = state.suppliers.find((s) => s.id === product.supplierId);
  const movements = history.data?.movements || [];
  const soldKg30 = history.data?.soldKg30 || 0;
  const daysLeft = soldKg30 > 0 ? Math.floor(product.stockKg / (soldKg30 / 30)) : null;

  const retail = Number(prices.retailPrice);
  const wholesale = Number(prices.wholesalePrice);
  const cost = Number(prices.costPerKg);

  const savePrices = () => {
    const reorder = Number(prices.reorderLevel);
    if ([retail, wholesale, cost, reorder].some((n) => !Number.isFinite(n) || n < 0)) {
      showToast('Please enter valid numbers', 'error');
      return;
    }
    if (wholesale > retail) {
      showToast('Wholesale price should not be higher than retail', 'error');
      return;
    }
    run(async () => {
      const result = await actions.updateProduct(product.id, { retailPrice: retail, wholesalePrice: wholesale, costPerKg: cost, reorderLevel: reorder });
      if (result.ok) showToast('Prices and reorder level saved');
    });
  };

  const saveAdjustment = () => {
    const amount = Number(adjustKg);
    if (!amount || amount <= 0) {
      showToast('Enter how many kilos to adjust', 'error');
      return;
    }
    if (direction === 'remove' && amount > product.stockKg) {
      showToast('You cannot remove more than the stock on hand', 'error');
      return;
    }
    run(async () => {
      if (!(await actions.adjustStock(product.id, direction === 'add' ? amount : -amount, reason)).ok) return;
      setAdjusting(false);
      setAdjustKg('');
      showToast('Stock adjusted');
    });
  };

  return (
    <Screen>
      <Card>
        <View style={styles.head}>
          <RiceThumb product={product} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{product.name}</Text>
            <Text style={styles.meta}>
              {product.category} · {product.origin}
            </Text>
            <View style={{ marginTop: 6 }}>
              <StockBadge product={product} />
            </View>
          </View>
        </View>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Show in customer catalog</Text>
            <Text style={styles.toggleText}>Turn off to hide this variety from the shop.</Text>
          </View>
          <Switch
            value={product.active}
            onValueChange={(v) => actions.updateProduct(product.id, { active: v })}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>
      </Card>

      <SectionHeader title="Stock" />
      <Card>
        <Text style={styles.stockBig}>{kg(product.stockKg)}</Text>
        <Text style={styles.stockSub}>
          ≈ {sacks(product.stockKg)} · reorder at {kg(product.reorderLevel)}
        </Text>
        <View style={styles.sep} />
        <InfoRow icon="chart-line" label="Sold (last 30 days)" value={history.data ? kg(soldKg30) : '…'} />
        <InfoRow icon="calendar-clock" label="Estimated to last" value={daysLeft == null ? '—' : `${daysLeft} days`} />
        <InfoRow icon="truck-outline" label="Main supplier" value={supplier ? supplier.name : '—'} />
        <View style={styles.buttons}>
          <Button
            title="Restock"
            icon="truck-plus-outline"
            size="sm"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/admin/purchase-order/new', params: { productId: product.id } })}
          />
          <Button title="Adjust stock" icon="scale-balance" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => setAdjusting(true)} />
        </View>
      </Card>

      <SectionHeader title="Retail & wholesale pricing" />
      <Card>
        <View style={styles.inputs}>
          <Input label="Retail / kg (₱)" keyboardType="decimal-pad" value={prices.retailPrice} onChangeText={(t) => setPrices({ ...prices, retailPrice: t })} style={styles.half} />
          <Input label="Wholesale / kg (₱)" keyboardType="decimal-pad" value={prices.wholesalePrice} onChangeText={(t) => setPrices({ ...prices, wholesalePrice: t })} style={styles.half} />
        </View>
        <View style={styles.inputs}>
          <Input label="Cost / kg (₱)" keyboardType="decimal-pad" value={prices.costPerKg} onChangeText={(t) => setPrices({ ...prices, costPerKg: t })} style={styles.half} />
          <Input label="Reorder level (kg)" keyboardType="number-pad" value={prices.reorderLevel} onChangeText={(t) => setPrices({ ...prices, reorderLevel: t })} style={styles.half} />
        </View>
        <View style={styles.margins}>
          <View style={styles.marginBox}>
            <Text style={styles.marginLabel}>Retail margin</Text>
            <Text style={styles.marginValue}>{peso(retail - cost)}/kg</Text>
            <Text style={styles.marginSub}>{peso((retail - cost) * 50, 0)} per sack</Text>
          </View>
          <View style={styles.marginBox}>
            <Text style={styles.marginLabel}>Wholesale margin</Text>
            <Text style={styles.marginValue}>{peso(wholesale - cost)}/kg</Text>
            <Text style={styles.marginSub}>{peso((wholesale - cost) * 50, 0)} per sack</Text>
          </View>
        </View>
        <Button title="Save Pricing" icon="content-save-outline" onPress={savePrices} loading={busy} style={{ marginTop: spacing.md }} />
      </Card>

      <SectionHeader title="Stock movement history" />
      <Card>
        {history.loading ? <Text style={styles.toggleText}>Loading stock history…</Text> : null}
        {history.error ? <Text style={styles.toggleText}>Could not load the history: {history.error}</Text> : null}
        {history.data && movements.length === 0 ? <Text style={styles.toggleText}>No stock movements yet.</Text> : null}
        {(showAll ? movements : movements.slice(0, 8)).map((m, i) => {
          const meta = MOVEMENT[m.type];
          const positive = m.kg > 0;
          return (
            <View key={m.id} style={[styles.move, i > 0 && styles.moveBorder]}>
              <View style={[styles.moveIcon, { backgroundColor: positive ? colors.successLight : colors.dangerLight }]}>
                <Icon name={meta.icon} size={17} color={positive ? colors.success : colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moveTitle}>
                  {meta.label} · {m.ref}
                </Text>
                <Text style={styles.moveSub} numberOfLines={1}>
                  {m.note} · {formatDateTime(m.at)}
                </Text>
              </View>
              <Text style={[styles.moveKg, { color: positive ? colors.success : colors.danger }]}>
                {positive ? '+' : '−'}
                {kg(Math.abs(m.kg))}
              </Text>
            </View>
          );
        })}
        {movements.length > 8 ? (
          <Button title={showAll ? 'Show less' : `Show all ${movements.length}`} variant="ghost" size="sm" onPress={() => setShowAll(!showAll)} />
        ) : null}
      </Card>

      <ModalSheet
        visible={adjusting}
        title="Adjust stock"
        onClose={() => setAdjusting(false)}
        footer={<Button title="Save Adjustment" icon="check" onPress={saveAdjustment} loading={busy} />}
      >
        <Segmented
          options={[
            { value: 'add', label: 'Add stock' },
            { value: 'remove', label: 'Remove stock' },
          ]}
          value={direction}
          onChange={setDirection}
        />
        <Input
          label="Kilos"
          keyboardType="decimal-pad"
          placeholder="e.g. 25"
          value={adjustKg}
          onChangeText={setAdjustKg}
          style={{ marginTop: spacing.lg }}
          hint={`Current stock: ${kg(product.stockKg)}`}
        />
        <Text style={styles.reasonLabel}>Reason</Text>
        <ChipRow options={REASONS.map((r) => ({ value: r, label: r }))} value={reason} onChange={setReason} />
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  toggleText: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  stockBig: { fontSize: 30, fontWeight: '900', color: colors.text },
  stockSub: { fontSize: 13, color: colors.textMuted },
  sep: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  inputs: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  margins: { flexDirection: 'row', gap: spacing.md },
  marginBox: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md },
  marginLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  marginValue: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 },
  marginSub: { fontSize: 11.5, color: colors.textMuted },
  move: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  moveBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  moveIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  moveTitle: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  moveSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  moveKg: { fontSize: 14, fontWeight: '800' },
  reasonLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
});
