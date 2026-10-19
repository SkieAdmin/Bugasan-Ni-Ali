// Admin: rice inventory monitoring with low-stock alerts.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { useParamFilter } from '../../../hooks/useParamFilter';
import {
  Card,
  ChipRow,
  EmptyState,
  IconButton,
  Input,
  RiceThumb,
  Screen,
  ScreenHeader,
  StatCard,
  StockBadge,
} from '../../../components';
import { stockStatus } from '../../../utils/pricing';
import { inventorySummary } from '../../../utils/reports';
import { kg, peso, sacks } from '../../../utils/format';
import { colors, spacing } from '../../../theme';

const BAR_COLORS = { ok: colors.chartRetail, low: '#D48A0B', out: colors.danger };

export default function InventoryScreen() {
  const { state } = useApp();
  const [filter, setFilter] = useParamFilter('all');
  const [query, setQuery] = useState('');

  const summary = inventorySummary(state.products);
  const q = query.trim().toLowerCase();
  const list = state.products
    .filter((p) => (filter === 'all' ? true : filter === 'low' ? stockStatus(p) !== 'ok' : stockStatus(p) === 'out'))
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => a.stockKg / a.reorderLevel - b.stockKg / b.reorderLevel);

  const options = [
    { value: 'all', label: 'All varieties', count: state.products.length },
    { value: 'low', label: 'Low stock', count: summary.low + summary.out },
    { value: 'out', label: 'Out of stock', count: summary.out },
  ];

  return (
    <Screen
      safeTop
      header={
        <ScreenHeader
          title="Inventory"
          subtitle="Stock levels update automatically after every sale"
          right={<IconButton icon="plus" bg={colors.primary} color={colors.white} onPress={() => router.push('/admin/product/new')} />}
        />
      }
    >
      <View style={styles.stats}>
        <StatCard icon="weight-kilogram" label="Stock on hand" value={kg(summary.totalKg)} sub={sacks(summary.totalKg)} />
        <StatCard icon="cash-multiple" label="Stock value (cost)" value={peso(summary.value, 0)} sub={`Retail value ${peso(summary.retailValue, 0)}`} tone="info" />
      </View>

      <Input icon="magnify" placeholder="Search rice variety" value={query} onChangeText={setQuery} style={{ marginBottom: spacing.sm }} />
      <ChipRow options={options} value={filter} onChange={setFilter} style={{ marginBottom: spacing.lg }} />

      {list.length === 0 ? (
        <EmptyState icon="check-circle-outline" title="Nothing here" message="All rice varieties are well stocked." />
      ) : (
        list.map((p) => {
          const status = stockStatus(p);
          const fill = Math.min(1, p.stockKg / (p.reorderLevel * 3));
          return (
            <Card key={p.id} onPress={() => router.push(`/admin/product/${p.id}`)} style={styles.item}>
              <View style={styles.row}>
                <RiceThumb product={p} size={48} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.meta}>
                    {p.category} · {peso(p.retailPrice, 0)} / {peso(p.wholesalePrice, 0)} per kg
                  </Text>
                </View>
                <StockBadge product={p} />
              </View>
              <View style={styles.stockRow}>
                <Text style={styles.stock}>{kg(p.stockKg)}</Text>
                <Text style={styles.sacks}>≈ {sacks(p.stockKg)}</Text>
                <Text style={styles.reorder}>Reorder at {kg(p.reorderLevel)}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(fill * 100, p.stockKg > 0 ? 2 : 0)}%`, backgroundColor: BAR_COLORS[status] }]} />
                <View style={[styles.marker, { left: '33.3%' }]} />
              </View>
              {!p.active ? <Text style={styles.hidden}>Hidden from catalog</Text> : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  item: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  stockRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.md, marginBottom: 6 },
  stock: { fontSize: 18, fontWeight: '800', color: colors.text },
  sacks: { fontSize: 12.5, color: colors.textMuted, flex: 1 },
  reorder: { fontSize: 12, color: colors.textMuted },
  track: { height: 10, borderRadius: 4, backgroundColor: colors.chartTrack, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.textMuted },
  hidden: { fontSize: 12, color: colors.danger, marginTop: spacing.sm, fontWeight: '600' },
});

