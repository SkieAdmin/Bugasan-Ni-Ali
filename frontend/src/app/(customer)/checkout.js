// Checkout: pickup or delivery, schedule, payment method (cash or digital) and place order.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { Button, Card, EmptyState, Icon, InfoRow, Input, Screen, SectionHeader } from '../../components';
import { useBusy } from '../../hooks/useBusy';
import { computeCart, unitLabel } from '../../utils/pricing';
import { PAYMENT_METHODS, TIME_SLOTS } from '../../utils/orders';
import { addDays, formatDayLabel, kg, peso, startOfDay } from '../../utils/format';
import { colors, radius, spacing } from '../../theme';

// Next 7 open days (the store is closed on Sundays).
function upcomingDays() {
  const days = [];
  let d = startOfDay(new Date());
  while (days.length < 7) {
    if (d.getDay() !== 0) days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

function OptionCard({ active, icon, title, text, right, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.option, active && styles.optionActive]}>
      <View style={[styles.optionIcon, active && { backgroundColor: colors.primary }]}>
        <Icon name={icon} size={22} color={active ? colors.white : colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionText}>{text}</Text>
      </View>
      {right ? <Text style={styles.optionRight}>{right}</Text> : null}
      <Icon name={active ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={active ? colors.primary : colors.border} />
    </Pressable>
  );
}

export default function CheckoutScreen() {
  const { state, currentUser, actions, showToast } = useApp();
  const days = useMemo(() => upcomingDays(), []);
  const [fulfillment, setFulfillment] = useState('delivery');
  const [address, setAddress] = useState(currentUser.address);
  const [dayIndex, setDayIndex] = useState(0);
  const [slot, setSlot] = useState(TIME_SLOTS[1]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, run] = useBusy();
  const { store } = state;

  const totals = computeCart(state.cart, state.products, currentUser, state.pricingRules, state.settings, fulfillment);
  const method = PAYMENT_METHODS[paymentMethod];
  const amountForFreeDelivery = state.settings.freeDeliveryMin - (totals.subtotal - totals.discount);

  if (totals.lines.length === 0) {
    return <EmptyState icon="cart-outline" title="Your cart is empty" action="Browse Rice" onAction={() => router.navigate('/')} />;
  }

  const placeOrder = () =>
    run(async () => {
      const e = {};
      if (fulfillment === 'delivery' && !address.trim()) e.address = 'Please enter your delivery address.';
      if (method.digital && paymentRef.trim().length < 6) e.paymentRef = 'Enter the reference number from your payment.';
      setErrors(e);
      if (Object.keys(e).length) {
        showToast('Please complete the required details', 'error');
        return;
      }

      // The server checks the stock and computes the final price.
      const result = await actions.placeOrder({
        fulfillment,
        address: fulfillment === 'delivery' ? address.trim() : store.address,
        schedule: { date: days[dayIndex].toISOString(), slot },
        paymentMethod,
        paymentRef: paymentRef.trim(),
        notes: notes.trim(),
      });

      if (!result.ok) {
        if (result.fields) setErrors(result.fields);
        showToast(result.error, 'error');
        return;
      }
      showToast('Order placed successfully!');
      router.replace({ pathname: '/order/[id]', params: { id: result.order.id, placed: '1' } });
    });

  return (
    <Screen
      footer={<Button title={`Place Order · ${peso(totals.total)}`} icon="check-circle-outline" onPress={placeOrder} loading={busy} />}
    >
      <SectionHeader title="Pickup or delivery?" style={{ marginTop: 0 }} />
      <View style={{ gap: spacing.md }}>
        <OptionCard
          active={fulfillment === 'delivery'}
          icon="truck-delivery-outline"
          title="Deliver to me"
          text={`₱${state.settings.deliveryFee} fee · FREE for orders ${peso(state.settings.freeDeliveryMin, 0)}+`}
          onPress={() => setFulfillment('delivery')}
        />
        <OptionCard
          active={fulfillment === 'pickup'}
          icon="storefront-outline"
          title="Pick up at the store"
          text="No fee · we'll have it packed and ready"
          onPress={() => setFulfillment('pickup')}
        />
      </View>

      {fulfillment === 'delivery' ? (
        <View style={{ marginTop: spacing.lg }}>
          <Input
            label="Delivery address"
            icon="map-marker-outline"
            value={address}
            onChangeText={(t) => {
              setAddress(t);
              setErrors((x) => ({ ...x, address: undefined }));
            }}
            error={errors.address}
            hint={amountForFreeDelivery > 0 ? `Add ${peso(amountForFreeDelivery)} more to get FREE delivery.` : 'You get FREE delivery!'}
          />
        </View>
      ) : (
        <Card style={{ marginTop: spacing.lg }}>
          <InfoRow icon="store-outline" label="Store" value={store.name} />
          <InfoRow icon="map-marker-outline" label="Address" value={store.address} />
          <InfoRow icon="clock-outline" label="Hours" value={store.hours} />
        </Card>
      )}

      <SectionHeader title={fulfillment === 'delivery' ? 'Delivery schedule' : 'Pickup schedule'} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {days.map((d, i) => {
          const label = formatDayLabel(d);
          const active = i === dayIndex;
          return (
            <Pressable key={d.toISOString()} onPress={() => setDayIndex(i)} style={[styles.day, active && styles.dayActive]}>
              <Text style={[styles.dayName, active && styles.dayTextActive]}>{i === 0 ? 'Today' : label.day}</Text>
              <Text style={[styles.dayDate, active && styles.dayTextActive]}>{label.date}</Text>
              <Text style={[styles.dayName, active && styles.dayTextActive]}>{label.month}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.slots}>
        {TIME_SLOTS.map((s) => {
          const active = s === slot;
          return (
            <Pressable key={s} onPress={() => setSlot(s)} style={[styles.slot, active && styles.slotActive]}>
              <Icon name="clock-outline" size={15} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.slotText, active && { color: colors.primaryDark }]}>{s}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Payment method" />
      <View style={{ gap: spacing.md }}>
        {Object.entries(PAYMENT_METHODS).map(([key, m]) => (
          <OptionCard
            key={key}
            active={paymentMethod === key}
            icon={m.icon}
            title={m.label}
            text={key === 'cash' ? (fulfillment === 'delivery' ? 'Cash on delivery' : 'Pay at the store') : m.hint}
            onPress={() => setPaymentMethod(key)}
          />
        ))}
      </View>

      {method.digital ? (
        <Card style={{ marginTop: spacing.lg, backgroundColor: colors.infoLight }}>
          <Text style={styles.payTitle}>Send {peso(totals.total)} to:</Text>
          <Text style={styles.payAccount}>{store[paymentMethod]}</Text>
          <Text style={styles.payHint}>Then enter the reference number below. The store will verify your payment.</Text>
          <Input
            placeholder="Reference number"
            icon="pound"
            value={paymentRef}
            onChangeText={(t) => {
              setPaymentRef(t);
              setErrors((x) => ({ ...x, paymentRef: undefined }));
            }}
            error={errors.paymentRef}
            autoCapitalize="characters"
            style={{ marginTop: spacing.md, marginBottom: 0 }}
          />
        </Card>
      ) : null}

      <Input label="Notes for the store (optional)" placeholder="e.g. Please call when you arrive" value={notes} onChangeText={setNotes} multiline style={{ marginTop: spacing.lg }} />

      <SectionHeader title="Order summary" />
      <Card>
        {totals.lines.map((l) => (
          <View key={l.key} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineName}>{l.product.name}</Text>
              <Text style={styles.lineDetail}>
                {unitLabel(l.unit, l.qty)} · {kg(l.kg)} @ {peso(l.pricePerKg)}
              </Text>
            </View>
            <Text style={styles.lineTotal}>{peso(l.total)}</Text>
          </View>
        ))}
        <View style={styles.sep} />
        <InfoRow label="Subtotal" value={peso(totals.subtotal)} />
        <InfoRow label="Bulk discounts" value={`-${peso(totals.discount)}`} valueStyle={{ color: colors.success }} />
        <InfoRow
          label="Delivery fee"
          value={fulfillment === 'pickup' ? 'Pickup' : totals.deliveryFee ? peso(totals.deliveryFee) : 'FREE'}
        />
        <View style={styles.sep} />
        <InfoRow label="Total to pay" value={peso(totals.total)} bold />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  optionText: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  optionRight: { fontWeight: '700', color: colors.text },
  day: {
    width: 64,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayName: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600' },
  dayDate: { fontSize: 20, fontWeight: '800', color: colors.text, marginVertical: 2 },
  dayTextActive: { color: colors.white },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48.5%',
    flexGrow: 1,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  slotActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  slotText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  payTitle: { fontSize: 13, color: colors.info, fontWeight: '600' },
  payAccount: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 2 },
  payHint: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: 6 },
  lineName: { fontSize: 14, fontWeight: '700', color: colors.text },
  lineDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  lineTotal: { fontSize: 14, fontWeight: '700', color: colors.text },
  sep: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
});
