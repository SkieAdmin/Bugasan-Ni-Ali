// Admin: manage one order — move status forward, assign rider, verify payment, cancel.
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import {
  Button,
  Card,
  ChannelBadge,
  Chip,
  EmptyState,
  InfoRow,
  PaymentBadge,
  Screen,
  SectionHeader,
  StatusBadge,
  StatusTimeline,
} from '../../../components';
import { useBusy } from '../../../hooks/useBusy';
import { ORDER_STATUS, PAYMENT_METHODS, isActive, nextStatus } from '../../../utils/orders';
import { unitLabel } from '../../../utils/pricing';
import { formatDate, formatDateTime, kg, peso } from '../../../utils/format';
import { confirm } from '../../../utils/dialog';
import { colors, spacing } from '../../../theme';

const ACTION_ICONS = {
  confirmed: 'check-circle-outline',
  preparing: 'package-variant',
  out_for_delivery: 'truck-fast-outline',
  ready_for_pickup: 'storefront-outline',
  delivered: 'check-decagram',
  picked_up: 'check-decagram',
};

export default function ManageOrderScreen() {
  const { id } = useLocalSearchParams();
  const { state, actions, showToast } = useApp();
  const [busy, run] = useBusy();
  const { riders } = state;
  const order = state.orders.find((o) => o.id === id);

  if (!order) return <EmptyState title="Order not found" />;

  const next = nextStatus(order);
  const delivery = order.fulfillment === 'delivery';
  const canCancel = isActive(order) && order.status !== 'out_for_delivery';
  const digital = PAYMENT_METHODS[order.paymentMethod].digital;

  // One action at a time on this screen, so a double tap never skips a status.
  const advance = () =>
    run(async () => {
      if ((await actions.advanceOrder(order.id)).ok) showToast(`Order marked as ${ORDER_STATUS[next].label}`);
    });

  const cancel = () =>
    run(async () => {
      const ok = await confirm('Cancel order?', `${order.id} will be cancelled and ${kg(order.totalKg)} returned to inventory.`, 'Cancel Order', true);
      if (ok && (await actions.cancelOrder(order.id, 'Cancelled by store')).ok) showToast('Order cancelled · stock returned');
    });

  const markPaid = () =>
    run(async () => {
      if ((await actions.markPaid(order.id)).ok) showToast(digital ? 'Payment verified' : 'Cash payment recorded');
    });

  const chooseRider = (rider) => run(() => actions.setRider(order.id, rider));

  return (
    <Screen>
      <Card>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>{order.id}</Text>
            <Text style={styles.date}>{formatDateTime(order.createdAt)}</Text>
          </View>
          <StatusBadge status={order.status} />
        </View>
        <View style={styles.badges}>
          <ChannelBadge channel={order.channel} />
          <PaymentBadge status={order.paymentStatus} />
        </View>
      </Card>

      {next ? (
        <Card style={styles.actionCard}>
          <Text style={styles.actionTitle}>Next step</Text>
          {next === 'out_for_delivery' ? (
            <>
              <Text style={styles.actionHint}>Choose the rider for this delivery:</Text>
              <View style={styles.riders}>
                {riders.map((r) => (
                  <Chip
                    key={r.name}
                    label={`${r.name} · ${r.vehicle}`}
                    icon="moped"
                    selected={(order.rider || riders[0])?.name === r.name}
                    onPress={() => chooseRider(r)}
                  />
                ))}
              </View>
            </>
          ) : null}
          <Button title={`Mark as ${ORDER_STATUS[next].label}`} icon={ACTION_ICONS[next]} onPress={advance} loading={busy} />
          {canCancel ? <Button title="Cancel Order" variant="danger" icon="close-circle-outline" onPress={cancel} disabled={busy} style={{ marginTop: spacing.sm }} /> : null}
        </Card>
      ) : null}

      <SectionHeader title="Customer" />
      <Card>
        <InfoRow icon="account-outline" label="Name" value={order.customerName} />
        {order.contactName !== order.customerName ? <InfoRow icon="account-tie-outline" label="Contact" value={order.contactName} /> : null}
        <InfoRow icon="phone-outline" label="Phone" value={order.customerPhone} />
      </Card>

      <SectionHeader title={delivery ? 'Delivery' : 'Pickup'} />
      <Card>
        <InfoRow icon={delivery ? 'truck-delivery-outline' : 'storefront-outline'} label="Method" value={delivery ? 'Delivery' : 'Store pickup'} />
        {delivery ? <InfoRow icon="map-marker-outline" label="Address" value={order.address} /> : null}
        <InfoRow icon="calendar" label="Schedule" value={`${formatDate(order.schedule.date)}\n${order.schedule.slot}`} />
        {order.rider ? <InfoRow icon="moped" label="Rider" value={`${order.rider.name} (${order.rider.vehicle})`} /> : null}
        {order.notes ? <InfoRow icon="note-text-outline" label="Notes" value={order.notes} /> : null}
      </Card>

      <SectionHeader title={`Items · ${kg(order.totalKg)}`} />
      <Card>
        {order.items.map((item) => (
          <View key={`${item.productId}-${item.unit}`} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDetail}>
                {unitLabel(item.unit, item.qty)} · {kg(item.kg)} @ {peso(item.pricePerKg)} ({item.priceType})
              </Text>
              {item.discount > 0 ? (
                <Text style={styles.discount}>
                  {item.ruleName}: -{peso(item.discount)}
                </Text>
              ) : null}
            </View>
            <Text style={styles.itemTotal}>{peso(item.total)}</Text>
          </View>
        ))}
        <View style={styles.sep} />
        <InfoRow label="Subtotal" value={peso(order.subtotal)} />
        <InfoRow label="Discounts" value={`-${peso(order.discount)}`} />
        <InfoRow label="Delivery fee" value={delivery ? (order.deliveryFee ? peso(order.deliveryFee) : 'FREE') : '—'} />
        <InfoRow label="Total" value={peso(order.total)} bold />
      </Card>

      <SectionHeader title="Payment" />
      <Card>
        <InfoRow icon={PAYMENT_METHODS[order.paymentMethod].icon} label="Method" value={PAYMENT_METHODS[order.paymentMethod].label} />
        {order.paymentRef ? <InfoRow icon="pound" label="Reference" value={order.paymentRef} /> : null}
        <View style={styles.payRow}>
          <Text style={styles.payLabel}>Status</Text>
          <PaymentBadge status={order.paymentStatus} />
        </View>
        {order.status !== 'cancelled' && order.paymentStatus !== 'paid' ? (
          <Button
            title={digital ? 'Verify Payment' : 'Mark Cash as Received'}
            icon="cash-check"
            variant="secondary"
            onPress={markPaid}
            disabled={busy}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </Card>

      <SectionHeader title="Status history" />
      <Card>
        <StatusTimeline order={order} />
      </Card>

      <Button
        title="View Digital Receipt"
        icon="receipt-text-outline"
        variant="outline"
        onPress={() => router.push(`/admin/receipt/${order.id}`)}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  orderId: { fontSize: 20, fontWeight: '800', color: colors.text },
  date: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  badges: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionCard: { marginTop: spacing.md, borderWidth: 1.5, borderColor: colors.primary },
  actionTitle: { fontSize: 13, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm },
  actionHint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  riders: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  item: { flexDirection: 'row', gap: spacing.md, paddingVertical: 6 },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  discount: { fontSize: 12, color: colors.success, fontWeight: '600', marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: colors.text },
  sep: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  payLabel: { fontSize: 14, color: colors.textSecondary, marginLeft: 22 },
});
