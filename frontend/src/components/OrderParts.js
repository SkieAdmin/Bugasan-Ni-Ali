// Pieces used to show orders: cards, status badges and the tracking timeline.
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Badge, Card, Icon } from './Basics';
import { ORDER_STATUS, PAYMENT_METHODS, PAYMENT_STATUS, PO_STATUS, itemsSummary, statusFlow, toneColors } from '../utils/orders';
import { formatDate, formatDateTime, kg, peso } from '../utils/format';

export function StatusBadge({ status }) {
  const meta = ORDER_STATUS[status];
  return <Badge label={meta.label} tone={meta.tone} icon={meta.icon} />;
}

export function PaymentBadge({ status }) {
  const meta = PAYMENT_STATUS[status];
  return <Badge label={meta.label} tone={meta.tone} icon={status === 'paid' ? 'check' : undefined} />;
}

export function ChannelBadge({ channel }) {
  return channel === 'wholesale' ? (
    <Badge label="Wholesale" tone="info" icon="store" />
  ) : (
    <Badge label="Retail" tone="neutral" icon="home-outline" />
  );
}

export function OrderCard({ order, onPress, admin }) {
  return (
    <Card onPress={onPress} style={styles.orderCard}>
      <View style={styles.orderTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>{order.id}</Text>
          <Text style={styles.orderDate}>{formatDateTime(order.createdAt)}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {admin ? (
        <View style={styles.customerRow}>
          <Icon name="account-circle-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.customerName} numberOfLines={1}>
            {order.customerName}
          </Text>
          <ChannelBadge channel={order.channel} />
        </View>
      ) : null}

      <Text style={styles.items} numberOfLines={1}>
        {itemsSummary(order)}
      </Text>

      <View style={styles.orderBottom}>
        <View style={styles.meta}>
          <Icon
            name={order.fulfillment === 'delivery' ? 'truck-delivery-outline' : 'storefront-outline'}
            size={16}
            color={colors.textMuted}
          />
          <Text style={styles.metaText}>
            {order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'} · {kg(order.totalKg)} ·{' '}
            {PAYMENT_METHODS[order.paymentMethod].label}
          </Text>
        </View>
        <Text style={styles.total}>{peso(order.total)}</Text>
      </View>

      {admin && order.status !== 'cancelled' && order.paymentStatus !== 'paid' ? (
        <View style={{ marginTop: spacing.sm }}>
          <PaymentBadge status={order.paymentStatus} />
        </View>
      ) : null}
    </Card>
  );
}

// Supplier purchase order card.
export function PurchaseOrderCard({ po, onPress, hideSupplier }) {
  const meta = PO_STATUS[po.status];
  return (
    <Card onPress={onPress} style={styles.orderCard}>
      <View style={styles.orderTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>{po.id}</Text>
          <Text style={styles.orderDate}>Ordered {formatDate(po.orderedAt)}</Text>
        </View>
        <Badge label={meta.label} tone={meta.tone} icon={meta.icon} />
      </View>
      {!hideSupplier ? (
        <View style={styles.customerRow}>
          <Icon name="truck-outline" size={17} color={colors.textSecondary} />
          <Text style={styles.customerName} numberOfLines={1}>
            {po.supplierName}
          </Text>
        </View>
      ) : null}
      <Text style={styles.items} numberOfLines={1}>
        {po.items.map((i) => `${i.name} (${i.sacks} sacks)`).join(', ')}
      </Text>
      <View style={styles.orderBottom}>
        <Text style={styles.metaText}>
          {kg(po.totalKg)} · {po.status === 'received' ? `Received ${formatDate(po.receivedAt)}` : `Expected ${formatDate(po.expectedAt)}`}
        </Text>
        <Text style={styles.total}>{peso(po.totalCost)}</Text>
      </View>
    </Card>
  );
}

// Step-by-step progress of an order (used for status tracking).
export function StatusTimeline({ order }) {
  const history = Object.fromEntries(order.statusHistory.map((h) => [h.status, h.at]));
  const steps = order.status === 'cancelled' ? order.statusHistory.map((h) => h.status) : statusFlow(order);
  const currentIndex = steps.indexOf(order.status);

  return (
    <View>
      {steps.map((step, index) => {
        const meta = ORDER_STATUS[step];
        const reached = index <= currentIndex;
        const current = index === currentIndex;
        const tone = toneColors(current ? meta.tone : 'primary');
        const last = index === steps.length - 1;
        return (
          <View key={step} style={styles.step}>
            <View style={styles.stepRail}>
              <View
                style={[
                  styles.stepDot,
                  reached ? { backgroundColor: current ? tone.fg : colors.primary } : styles.stepDotPending,
                ]}
              >
                <Icon name={reached ? meta.icon : 'circle-small'} size={15} color={reached ? colors.white : colors.textMuted} />
              </View>
              {!last ? <View style={[styles.stepLine, index < currentIndex && { backgroundColor: colors.primary }]} /> : null}
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepTitle, !reached && { color: colors.textMuted }]}>{meta.label}</Text>
              <Text style={styles.stepTime}>
                {history[step] ? formatDateTime(history[step]) : current ? meta.description : 'Waiting'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  orderCard: { marginBottom: spacing.md },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  orderId: { fontSize: 15.5, fontWeight: '800', color: colors.text },
  orderDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  customerName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  items: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
  orderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.sm,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  metaText: { fontSize: 12.5, color: colors.textMuted, flexShrink: 1 },
  total: { fontSize: 16, fontWeight: '800', color: colors.primaryDark },

  step: { flexDirection: 'row', gap: spacing.md },
  stepRail: { alignItems: 'center', width: 30 },
  stepDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepDotPending: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border },
  stepLine: { width: 2, flex: 1, minHeight: 22, backgroundColor: colors.border, marginVertical: 2, borderRadius: radius.sm },
  stepBody: { flex: 1, paddingBottom: spacing.lg, paddingTop: 4 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  stepTime: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
});
