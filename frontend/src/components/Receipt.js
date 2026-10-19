// Digital receipt (shown to the customer and to the store).
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Icon } from './Basics';
import { useApp } from '../context/AppContext';
import { PAYMENT_METHODS, PAYMENT_STATUS, ORDER_STATUS } from '../utils/orders';
import { formatDate, formatDateTime, kg, peso } from '../utils/format';
import { unitLabel } from '../utils/pricing';

// `store` is the store info from the server (state.store).
export function receiptText(order, store) {
  const lines = [
    `${store.name.toUpperCase()}`,
    store.address,
    `Tel: ${store.phone}`,
    '------------------------------',
    `Receipt No: ${order.receiptNo}`,
    `Order No:   ${order.id}`,
    `Date:       ${formatDateTime(order.createdAt)}`,
    `Customer:   ${order.customerName}`,
    '------------------------------',
    ...order.items.map(
      (i) =>
        `${i.name}\n  ${unitLabel(i.unit, i.qty)} = ${kg(i.kg)} @ ${peso(i.pricePerKg)}/kg\n  ${peso(i.subtotal)}${i.discount ? `  (less ${peso(i.discount)})` : ''}`
    ),
    '------------------------------',
    `Subtotal:     ${peso(order.subtotal)}`,
    `Discount:    -${peso(order.discount)}`,
    `Delivery fee: ${peso(order.deliveryFee)}`,
    `TOTAL:        ${peso(order.total)}`,
    '------------------------------',
    `Payment: ${PAYMENT_METHODS[order.paymentMethod].label} (${PAYMENT_STATUS[order.paymentStatus].label})`,
    order.paymentRef ? `Ref No: ${order.paymentRef}` : null,
    `${order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}: ${formatDate(order.schedule.date)}, ${order.schedule.slot}`,
    '',
    'Salamat po sa pagbili!',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

function Dashes() {
  return <View style={styles.dashes} />;
}

function Row({ label, value, strong }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.strongValue]}>{value}</Text>
    </View>
  );
}

export function ReceiptView({ order }) {
  const { store } = useApp().state;
  const paid = order.paymentStatus === 'paid';
  return (
    <View style={styles.paper}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Icon name="rice" size={26} color={colors.white} />
        </View>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.storeLine}>{store.address}</Text>
        <Text style={styles.storeLine}>Tel. {store.phone}</Text>
      </View>

      <Text style={styles.title}>OFFICIAL DIGITAL RECEIPT</Text>
      <Dashes />

      <Row label="Receipt No." value={order.receiptNo} />
      <Row label="Order No." value={order.id} />
      <Row label="Date" value={formatDateTime(order.createdAt)} />
      <Row label="Customer" value={order.customerName} />
      <Row label="Type" value={order.channel === 'wholesale' ? 'Wholesale' : 'Retail'} />
      <Dashes />

      {order.items.map((item) => (
        <View key={`${item.productId}-${item.unit}`} style={styles.item}>
          <View style={styles.row}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemTotal}>{peso(item.subtotal)}</Text>
          </View>
          <Text style={styles.itemDetail}>
            {unitLabel(item.unit, item.qty)} · {kg(item.kg)} @ {peso(item.pricePerKg)}/kg
            {item.priceType === 'wholesale' ? ' (wholesale)' : ''}
          </Text>
          {item.discount > 0 ? (
            <View style={styles.row}>
              <Text style={styles.discountText}>{item.ruleName}</Text>
              <Text style={styles.discountText}>-{peso(item.discount)}</Text>
            </View>
          ) : null}
        </View>
      ))}
      <Dashes />

      <Row label="Subtotal" value={peso(order.subtotal)} />
      <Row label="Discounts" value={`-${peso(order.discount)}`} />
      <Row label={order.fulfillment === 'delivery' ? 'Delivery fee' : 'Pickup'} value={order.fulfillment === 'delivery' ? (order.deliveryFee ? peso(order.deliveryFee) : 'FREE') : '—'} />
      <Row label="TOTAL" value={peso(order.total)} strong />
      <Row label="Total weight" value={kg(order.totalKg)} />
      <Dashes />

      <Row label="Payment" value={PAYMENT_METHODS[order.paymentMethod].label} />
      {order.paymentRef ? <Row label="Reference No." value={order.paymentRef} /> : null}
      <Row label="Payment status" value={PAYMENT_STATUS[order.paymentStatus].label} />
      <Row label="Order status" value={ORDER_STATUS[order.status].label} />
      <Row
        label={order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}
        value={`${formatDate(order.schedule.date)}\n${order.schedule.slot}`}
      />

      <View style={[styles.stamp, { borderColor: paid ? colors.success : colors.warning }]}>
        <Text style={[styles.stampText, { color: paid ? colors.success : colors.warning }]}>
          {paid ? 'PAID' : order.status === 'cancelled' ? 'CANCELLED' : 'PAYMENT DUE'}
        </Text>
      </View>

      <Text style={styles.thanks}>Salamat po sa pagbili!</Text>
      <Text style={styles.footnote}>This digital receipt is system-generated by {store.name}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  brand: { alignItems: 'center' },
  logo: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  storeName: { fontSize: 19, fontWeight: '800', color: colors.text },
  storeLine: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  title: { textAlign: 'center', fontSize: 12, fontWeight: '800', color: colors.textSecondary, letterSpacing: 1.5, marginTop: spacing.lg },
  dashes: { borderTopWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', marginVertical: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 2 },
  rowLabel: { fontSize: 13, color: colors.textMuted },
  rowValue: { fontSize: 13, color: colors.text, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  strong: { fontSize: 16, fontWeight: '800', color: colors.text },
  strongValue: { fontSize: 18, fontWeight: '800', color: colors.primaryDark },
  item: { marginBottom: spacing.sm },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemDetail: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  discountText: { fontSize: 12, color: colors.success, fontWeight: '600' },
  stamp: { alignSelf: 'center', borderWidth: 2, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 4, marginTop: spacing.lg, transform: [{ rotate: '-4deg' }] },
  stampText: { fontWeight: '900', letterSpacing: 2, fontSize: 15 },
  thanks: { textAlign: 'center', fontWeight: '700', color: colors.text, marginTop: spacing.lg },
  footnote: { textAlign: 'center', fontSize: 11, color: colors.textMuted, marginTop: 4 },
});
