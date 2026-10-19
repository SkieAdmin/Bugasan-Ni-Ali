// Order status tracking for the customer.
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  InfoRow,
  PaymentBadge,
  Screen,
  SectionHeader,
  StatusTimeline,
} from '../../../components';
import { ORDER_STATUS, PAYMENT_METHODS, isActive, toneColors } from '../../../utils/orders';
import { unitLabel } from '../../../utils/pricing';
import { formatDate, formatDateTime, kg, peso } from '../../../utils/format';
import { confirm } from '../../../utils/dialog';
import { useBusy } from '../../../hooks/useBusy';
import { colors, radius, spacing } from '../../../theme';

export default function OrderTrackingScreen() {
  const { id, placed } = useLocalSearchParams();
  const { state, actions, showToast } = useApp();
  const [busy, run] = useBusy();
  const order = state.orders.find((o) => o.id === id);

  if (!order) return <EmptyState title="Order not found" />;

  const meta = ORDER_STATUS[order.status];
  const tone = toneColors(meta.tone);
  const delivery = order.fulfillment === 'delivery';

  const cancel = () =>
    run(async () => {
      const ok = await confirm('Cancel this order?', `${order.id} will be cancelled and the rice returned to the store.`, 'Cancel Order', true);
      if (ok && (await actions.cancelOrder(order.id, 'Cancelled by customer')).ok) showToast('Order cancelled');
    });

  const buyAgain = () => {
    let added = 0;
    order.items.forEach((item) => {
      if (actions.addToCart(item.productId, item.unit, item.qty).ok) added += 1;
    });
    if (added === order.items.length) showToast('Items added to your cart');
    else if (added > 0) showToast('Some items are low on stock and were skipped', 'error');
    else {
      showToast('Sorry, these items are out of stock right now', 'error');
      return;
    }
    router.navigate('/cart');
  };

  return (
    <Screen>
      {placed ? (
        <View style={styles.success}>
          <Icon name="check-circle" size={28} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>Order placed!</Text>
            <Text style={styles.successText}>We sent {order.id} to the store. You can follow its status here.</Text>
          </View>
        </View>
      ) : null}

      <Card style={styles.statusCard}>
        <View style={[styles.statusIcon, { backgroundColor: tone.bg }]}>
          <Icon name={meta.icon} size={30} color={tone.fg} />
        </View>
        <Text style={styles.orderId}>{order.id}</Text>
        <Text style={[styles.statusLabel, { color: tone.fg }]}>{meta.label}</Text>
        <Text style={styles.statusText}>{meta.description}</Text>
        {isActive(order) ? (
          <View style={styles.eta}>
            <Icon name="calendar-clock" size={16} color={colors.primaryDark} />
            <Text style={styles.etaText}>
              {delivery ? 'Delivery' : 'Pickup'}: {formatDate(order.schedule.date)}, {order.schedule.slot}
            </Text>
          </View>
        ) : null}
      </Card>

      {order.rider && delivery && isActive(order) ? (
        <Card style={styles.rider}>
          <View style={styles.riderIcon}>
            <Icon name="moped" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>{order.rider.name}</Text>
            <Text style={styles.riderText}>
              Your rider · {order.rider.vehicle} · {order.rider.phone}
            </Text>
          </View>
        </Card>
      ) : null}

      <SectionHeader title="Order progress" />
      <Card>
        <StatusTimeline order={order} />
      </Card>

      <SectionHeader title={delivery ? 'Delivery details' : 'Pickup details'} />
      <Card>
        <InfoRow icon={delivery ? 'truck-delivery-outline' : 'storefront-outline'} label="Method" value={delivery ? 'Delivery' : 'Store pickup'} />
        <InfoRow icon="map-marker-outline" label={delivery ? 'Address' : 'Store'} value={order.address} />
        <InfoRow icon="calendar" label="Schedule" value={`${formatDate(order.schedule.date)}\n${order.schedule.slot}`} />
        {order.notes ? <InfoRow icon="note-text-outline" label="Notes" value={order.notes} /> : null}
      </Card>

      <SectionHeader title="Items" />
      <Card>
        {order.items.map((item) => (
          <View key={`${item.productId}-${item.unit}`} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDetail}>
                {unitLabel(item.unit, item.qty)} · {kg(item.kg)} @ {peso(item.pricePerKg)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{peso(item.total)}</Text>
          </View>
        ))}
        <View style={styles.sep} />
        <InfoRow label="Subtotal" value={peso(order.subtotal)} />
        {order.discount > 0 ? <InfoRow label="Discounts" value={`-${peso(order.discount)}`} valueStyle={{ color: colors.success }} /> : null}
        {delivery ? <InfoRow label="Delivery fee" value={order.deliveryFee ? peso(order.deliveryFee) : 'FREE'} /> : null}
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
        <InfoRow icon="clock-outline" label="Ordered" value={formatDateTime(order.createdAt)} />
      </Card>

      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        <Button title="View Digital Receipt" icon="receipt-text-outline" variant="secondary" onPress={() => router.push(`/receipt/${order.id}`)} />
        {!isActive(order) ? <Button title="Buy Again" icon="cart-arrow-down" variant="outline" onPress={buyAgain} /> : null}
        {order.status === 'pending' ? <Button title="Cancel Order" icon="close-circle-outline" variant="danger" onPress={cancel} loading={busy} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  success: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  successTitle: { fontSize: 16, fontWeight: '800', color: colors.success },
  successText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  statusCard: { alignItems: 'center', paddingVertical: spacing.xl },
  statusIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  orderId: { fontSize: 13, color: colors.textMuted, fontWeight: '700', marginTop: spacing.md },
  statusLabel: { fontSize: 24, fontWeight: '900', marginTop: 2 },
  statusText: { fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.lg },
  eta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
  },
  etaText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  rider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  riderIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  riderName: { fontSize: 15, fontWeight: '800', color: colors.text },
  riderText: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  item: { flexDirection: 'row', gap: spacing.md, paddingVertical: 6 },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: colors.text },
  sep: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  payLabel: { fontSize: 14, color: colors.textSecondary, marginLeft: 22 },
});
