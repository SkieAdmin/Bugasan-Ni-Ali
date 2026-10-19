// Admin dashboard: today's numbers, low-stock alerts, weekly sales and recent orders.
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import {
  Button,
  Card,
  ColumnChart,
  Icon,
  ListRow,
  OrderCard,
  RiceThumb,
  Screen,
  SectionHeader,
  StatCard,
  StockBadge,
} from '../../../components';
import { stockStatus } from '../../../utils/pricing';
import { formatDate, isSameDay, kg, peso } from '../../../utils/format';
import { salesOrders, salesSeries } from '../../../utils/reports';
import { colors, font, radius, spacing } from '../../../theme';

export default function DashboardScreen() {
  const { state, currentUser } = useApp();
  const today = new Date();

  const todaysOrders = state.orders.filter((o) => o.status !== 'cancelled' && isSameDay(o.createdAt, today));
  const todaysSales = todaysOrders.reduce((s, o) => s + o.total, 0);
  const pending = state.orders.filter((o) => o.status === 'pending');
  const toVerify = state.orders.filter((o) => o.paymentStatus === 'for_verification' && o.status !== 'cancelled');
  const alerts = state.products
    .filter((p) => p.active && stockStatus(p) !== 'ok')
    .sort((a, b) => a.stockKg / a.reorderLevel - b.stockKg / b.reorderLevel);
  const week = salesSeries(salesOrders(state.orders, 7), 7);
  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const pendingApprovals = state.users.filter((u) => u.wholesaleStatus === 'pending').length;
  const openPOs = state.purchaseOrders.filter((p) => p.status === 'ordered').length;

  return (
    <Screen safeTop>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Icon name="rice" size={26} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.store}>{state.store.name}</Text>
          <Text style={font.h2}>Hi, {currentUser.name.split(' ')[0]}!</Text>
        </View>
        <Text style={styles.date}>{formatDate(today)}</Text>
      </View>

      <View style={styles.grid}>
        <StatCard icon="cash-register" label="Today's sales" value={peso(todaysSales, 0)} sub={`${todaysOrders.length} orders`} tone="primary" />
        <StatCard
          icon="clock-alert-outline"
          label="Pending orders"
          value={String(pending.length)}
          sub="Need confirmation"
          tone="warning"
          onPress={() => router.navigate({ pathname: '/admin/orders', params: { filter: 'pending' } })}
        />
      </View>
      <View style={styles.grid}>
        <StatCard
          icon="alert-outline"
          label="Low / out of stock"
          value={String(alerts.length)}
          sub="Rice varieties"
          tone="danger"
          onPress={() => router.navigate({ pathname: '/admin/inventory', params: { filter: 'low' } })}
        />
        <StatCard
          icon="cellphone-check"
          label="Payments to verify"
          value={String(toVerify.length)}
          sub="GCash / Maya / Bank"
          tone="info"
          onPress={() => router.navigate({ pathname: '/admin/orders', params: { filter: 'unpaid' } })}
        />
      </View>

      {alerts.length ? (
        <>
          <SectionHeader title="Low-stock alerts" action="Inventory" onAction={() => router.navigate('/admin/inventory')} />
          <Card style={styles.alertCard}>
            {alerts.map((p, i) => (
              <View key={p.id} style={[styles.alertRow, i > 0 && styles.alertBorder]}>
                <RiceThumb product={p} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertName}>{p.name}</Text>
                  <Text style={styles.alertText}>
                    {kg(p.stockKg)} left · reorder at {kg(p.reorderLevel)}
                  </Text>
                  <View style={{ marginTop: 4 }}>
                    <StockBadge product={p} />
                  </View>
                </View>
                <Button
                  title="Restock"
                  size="sm"
                  variant="secondary"
                  icon="truck-plus-outline"
                  onPress={() => router.push({ pathname: '/admin/purchase-order/new', params: { productId: p.id } })}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Sales this week" action="Reports" onAction={() => router.navigate('/admin/reports')} />
      <Card>
        <Text style={styles.weekTotal}>{peso(weekTotal)}</Text>
        <Text style={styles.weekSub}>Last 7 days · all channels</Text>
        <ColumnChart data={week} formatValue={(v) => peso(v, 0)} height={110} />
      </Card>

      <SectionHeader title="Recent orders" action="See all" onAction={() => router.navigate('/admin/orders')} />
      {state.orders.slice(0, 4).map((o) => (
        <OrderCard key={o.id} order={o} admin onPress={() => router.push(`/admin/order/${o.id}`)} />
      ))}

      <SectionHeader title="Manage store" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <ListRow icon="truck-outline" title="Suppliers" subtitle={`${state.suppliers.length} suppliers`} onPress={() => router.push('/admin/suppliers')} />
        <ListRow
          icon="clipboard-arrow-down-outline"
          title="Purchase Orders"
          subtitle={openPOs ? `${openPOs} awaiting delivery` : 'Record supplier restocks'}
          tone="info"
          onPress={() => router.push('/admin/purchase-orders')}
        />
        <ListRow
          icon="store-outline"
          title="Wholesale Customers"
          subtitle={pendingApprovals ? `${pendingApprovals} waiting for approval` : 'Resellers and businesses'}
          tone="accent"
          onPress={() => router.push('/admin/wholesale')}
        />
        <ListRow icon="tag-multiple-outline" title="Pricing & Discounts" subtitle="Retail, wholesale & bulk rules" onPress={() => router.push('/admin/pricing')} last />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  logo: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  store: { fontSize: 12.5, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  date: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  grid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  alertCard: { borderLeftWidth: 4, borderLeftColor: colors.warning, borderRadius: radius.lg },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  alertBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  alertName: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  alertText: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  weekTotal: { fontSize: 24, fontWeight: '800', color: colors.text },
  weekSub: { fontSize: 12.5, color: colors.textMuted },
});
