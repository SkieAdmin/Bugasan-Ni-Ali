// Admin reports: sales, inventory, best sellers, retail vs wholesale, supplier purchases.
// Each report is worked out by the server (GET /api/reports/...) over all orders.
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import {
  BarList,
  Card,
  ChipRow,
  ColumnChart,
  EmptyState,
  IconButton,
  InfoRow,
  LoadingScreen,
  PurchaseOrderCard,
  RiceThumb,
  Screen,
  ScreenHeader,
  Segmented,
  ShareBar,
  StatCard,
} from '../../../components';
import { stockStatus } from '../../../utils/pricing';
import { kg, peso, sacks } from '../../../utils/format';
import { api } from '../../../api/client';
import { useApiData } from '../../../hooks/useApiData';
import { colors, radius, spacing } from '../../../theme';

const REPORTS = [
  { value: 'sales', label: 'Sales', icon: 'cash-register' },
  { value: 'inventory', label: 'Inventory', icon: 'warehouse' },
  { value: 'best', label: 'Best Sellers', icon: 'trophy-outline' },
  { value: 'channel', label: 'Retail vs Wholesale', icon: 'scale-unbalanced' },
  { value: 'suppliers', label: 'Supplier Purchases', icon: 'truck-outline' },
];

function Grid({ children }) {
  return <View style={styles.grid}>{children}</View>;
}

function ChartCard({ title, subtitle, children }) {
  return (
    <Card style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      {subtitle ? <Text style={styles.chartSub}>{subtitle}</Text> : null}
      <View style={{ marginTop: spacing.md }}>{children}</View>
    </Card>
  );
}

// Shown while a report loads, or when it could not be loaded.
function ReportStatus({ error }) {
  if (error) return <EmptyState icon="cloud-off-outline" title="Could not load this report" message={error} />;
  return <LoadingScreen message="Loading report…" />;
}

function SalesReport({ days }) {
  const { data, error } = useApiData(`/reports/sales?days=${days}`);
  if (!data) return <ReportStatus error={error} />;
  const { summary: s, series, payments } = data;
  return (
    <>
      <Grid>
        <StatCard icon="cash-multiple" label="Total sales" value={peso(s.total, 0)} />
        <StatCard icon="receipt-text-outline" label="Orders" value={String(s.count)} tone="info" />
      </Grid>
      <Grid>
        <StatCard icon="calculator-variant-outline" label="Average order" value={peso(s.average, 0)} tone="accent" />
        <StatCard icon="weight-kilogram" label="Rice sold" value={kg(s.kg)} sub={sacks(s.kg)} tone="primary" />
      </Grid>
      <ChartCard title={days > 31 ? 'Weekly sales' : 'Daily sales'} subtitle="Total of all non-cancelled orders">
        <ColumnChart data={series} formatValue={(v) => peso(v, 0)} />
      </ChartCard>
      <ChartCard title="Sales by payment method" subtitle="Cash vs digital payments">
        <BarList
          data={payments.map((p) => ({
            key: p.key,
            label: p.label,
            value: p.revenue,
            valueLabel: peso(p.revenue, 0),
            sub: `${p.count} orders`,
          }))}
        />
      </ChartCard>
      <Card>
        <InfoRow label="Bulk discounts given" value={peso(s.discounts)} />
        <InfoRow label="Cancelled orders (not counted)" value={String(data.cancelled)} />
      </Card>
    </>
  );
}

function InventoryReport({ days }) {
  const { data, error } = useApiData(`/reports/inventory?days=${days}`);
  if (!data) return <ReportStatus error={error} />;
  const { summary: inv, movements: moves, products } = data;
  return (
    <>
      <Grid>
        <StatCard icon="weight-kilogram" label="Stock on hand" value={kg(inv.totalKg)} sub={sacks(inv.totalKg)} />
        <StatCard icon="cash-multiple" label="Stock value (cost)" value={peso(inv.value, 0)} tone="info" />
      </Grid>
      <Grid>
        <StatCard icon="alert-outline" label="Low stock" value={String(inv.low)} sub="varieties" tone="warning" onPress={() => router.navigate({ pathname: '/admin/inventory', params: { filter: 'low' } })} />
        <StatCard icon="close-circle-outline" label="Out of stock" value={String(inv.out)} sub="varieties" tone="danger" onPress={() => router.navigate({ pathname: '/admin/inventory', params: { filter: 'out' } })} />
      </Grid>
      <ChartCard title="Stock movement" subtitle={`Last ${days} days`}>
        <InfoRow icon="cart-arrow-right" label="Sold to customers" value={`− ${kg(moves.sold)}`} />
        <InfoRow icon="truck-delivery-outline" label="Restocked from suppliers" value={`+ ${kg(moves.restocked)}`} />
        <InfoRow icon="undo-variant" label="Returned (cancelled orders)" value={`+ ${kg(moves.returned)}`} />
        <InfoRow icon="scale-balance" label="Manual adjustments" value={`${moves.adjusted >= 0 ? '+' : '−'} ${kg(Math.abs(moves.adjusted))}`} />
      </ChartCard>
      <ChartCard title="Stock by rice variety" subtitle="Kilos on hand right now">
        <BarList
          data={products.map((p) => {
            const status = stockStatus(p);
            return {
              key: p.id,
              label: p.name,
              value: p.stockKg,
              valueLabel: kg(p.stockKg),
              icon: status === 'ok' ? undefined : status === 'out' ? 'close-circle' : 'alert',
              iconColor: status === 'out' ? colors.danger : colors.warning,
              sub: `Reorder at ${kg(p.reorderLevel)}${status === 'low' ? ' · Low stock' : status === 'out' ? ' · Out of stock' : ''}`,
            };
          })}
        />
      </ChartCard>
    </>
  );
}

function BestSellersReport({ days }) {
  const { data, error } = useApiData(`/reports/best-sellers?days=${days}`);
  if (!data) return <ReportStatus error={error} />;
  const { list } = data;
  if (!list.length) return <EmptyState icon="trophy-outline" title="No sales in this period" />;
  const top = list[0];
  return (
    <>
      <Card style={styles.topSeller}>
        <RiceThumb product={top.product} size={60} />
        <View style={{ flex: 1 }}>
          <Text style={styles.topLabel}>BEST-SELLING VARIETY</Text>
          <Text style={styles.topName}>{top.product.name}</Text>
          <Text style={styles.topSub}>
            {kg(top.kg)} sold · {peso(top.revenue, 0)} · {top.orders} orders
          </Text>
        </View>
      </Card>
      <ChartCard title="Ranking by kilos sold" subtitle={`Last ${days} days`}>
        <BarList
          data={list.map((x, i) => ({
            key: x.productId,
            rank: i + 1,
            label: x.product.name,
            value: x.kg,
            valueLabel: kg(x.kg),
            sub: `${peso(x.revenue, 0)} sales · ${x.orders} orders`,
          }))}
        />
      </ChartCard>
    </>
  );
}

function ChannelReport({ days }) {
  const { data, error } = useApiData(`/reports/channels?days=${days}`);
  if (!data) return <ReportStatus error={error} />;
  const { retail, wholesale } = data;
  return (
    <>
      <Grid>
        <StatCard icon="home-outline" label="Retail sales" value={peso(retail.revenue, 0)} sub={`${retail.count} orders`} />
        <StatCard icon="store-outline" label="Wholesale sales" value={peso(wholesale.revenue, 0)} sub={`${wholesale.count} orders`} tone="info" />
      </Grid>
      <ChartCard title="Share of sales (₱)">
        <ShareBar
          segments={[
            { key: 'retail', label: 'Retail', value: retail.revenue, color: colors.chartRetail, valueLabel: peso(retail.revenue, 0) },
            { key: 'wholesale', label: 'Wholesale', value: wholesale.revenue, color: colors.chartWholesale, valueLabel: peso(wholesale.revenue, 0) },
          ]}
        />
      </ChartCard>
      <ChartCard title="Share of rice sold (kg)">
        <ShareBar
          segments={[
            { key: 'retail', label: 'Retail', value: retail.kg, color: colors.chartRetail, valueLabel: kg(retail.kg) },
            { key: 'wholesale', label: 'Wholesale', value: wholesale.kg, color: colors.chartWholesale, valueLabel: kg(wholesale.kg) },
          ]}
        />
      </ChartCard>
      <Card padded={false}>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 1.2 }]}> </Text>
          <Text style={styles.th}>Retail</Text>
          <Text style={styles.th}>Wholesale</Text>
        </View>
        {[
          ['Orders', String(retail.count), String(wholesale.count)],
          ['Sales', peso(retail.revenue, 0), peso(wholesale.revenue, 0)],
          ['Rice sold', kg(retail.kg), kg(wholesale.kg)],
          ['Avg. order', peso(retail.average, 0), peso(wholesale.average, 0)],
        ].map(([label, a, b]) => (
          <View key={label} style={styles.tr}>
            <Text style={[styles.tdLabel, { flex: 1.2 }]}>{label}</Text>
            <Text style={styles.td}>{a}</Text>
            <Text style={styles.td}>{b}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

function SupplierReport({ days }) {
  const { data, error } = useApiData(`/reports/supplier-purchases?days=${days}`);
  if (!data) return <ReportStatus error={error} />;
  return (
    <>
      <Grid>
        <StatCard icon="cash-minus" label="Total purchases" value={peso(data.totalCost, 0)} sub={`${data.list.length} purchase orders`} />
        <StatCard icon="weight-kilogram" label="Rice purchased" value={kg(data.totalKg)} sub={`${data.pending} awaiting delivery`} tone="info" />
      </Grid>
      <ChartCard title="Purchases by supplier" subtitle={`Last ${days} days · cancelled POs excluded`}>
        <BarList
          data={data.rows.map((r) => ({
            key: r.supplier.id,
            label: r.supplier.name,
            value: r.cost,
            valueLabel: peso(r.cost, 0),
            sub: `${r.count} POs · ${kg(r.kg)}${r.pending ? ` · ${r.pending} pending` : ''}`,
          }))}
        />
      </ChartCard>
      <Text style={styles.listTitle}>Purchase orders in this period</Text>
      {data.list.length === 0 ? (
        <EmptyState icon="clipboard-text-outline" title="No purchases in this period" />
      ) : (
        data.list.map((po) => <PurchaseOrderCard key={po.id} po={po} onPress={() => router.push(`/admin/purchase-order/${po.id}`)} />)
      )}
    </>
  );
}

export default function ReportsScreen() {
  const { showToast } = useApp();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState('sales');

  const share = async () => {
    let text;
    try {
      ({ text } = await api.get(`/reports/share?days=${days}`));
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
    try {
      await Share.share({ title: 'Bugasan ni Ali report', message: text });
    } catch {
      showToast('Sharing is not available on this device', 'error');
    }
  };

  const Report = { sales: SalesReport, inventory: InventoryReport, best: BestSellersReport, channel: ChannelReport, suppliers: SupplierReport }[report];

  return (
    <Screen
      safeTop
      header={
        <ScreenHeader
          title="Reports"
          subtitle="Sales, inventory and supplier summaries"
          right={<IconButton icon="share-variant-outline" bg={colors.primaryLight} color={colors.primary} onPress={share} />}
        >
          <ChipRow options={REPORTS} value={report} onChange={setReport} style={{ marginTop: spacing.md }} />
        </ScreenHeader>
      }
    >
      <Segmented
        options={[
          { value: 7, label: 'Last 7 days' },
          { value: 30, label: 'Last 30 days' },
          { value: 90, label: 'Last 90 days' },
        ]}
        value={days}
        onChange={setDays}
        style={{ marginBottom: spacing.lg }}
      />
      <Report days={days} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  chartCard: { marginBottom: spacing.md },
  chartTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  chartSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  topSeller: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.accent },
  topLabel: { fontSize: 11, fontWeight: '800', color: colors.warning, letterSpacing: 0.8 },
  topName: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 },
  topSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  tableHead: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  th: { flex: 1, fontSize: 12, fontWeight: '800', color: colors.textMuted, textAlign: 'right', textTransform: 'uppercase' },
  tr: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tdLabel: { fontSize: 14, color: colors.textSecondary },
  td: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'right' },
  listTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: spacing.md, marginBottom: spacing.md },
});
