// Shopping cart.
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  InfoRow,
  QuantityStepper,
  RiceThumb,
  Screen,
  ScreenHeader,
} from '../../../components';
import { computeCart, unitLabel } from '../../../utils/pricing';
import { kg, peso } from '../../../utils/format';
import { colors, spacing } from '../../../theme';

export default function CartScreen() {
  const { state, currentUser, actions, showToast } = useApp();
  const totals = computeCart(state.cart, state.products, currentUser, state.pricingRules, state.settings, 'pickup');

  const changeQty = (key, qty) => {
    const result = actions.setCartQty(key, qty);
    if (!result.ok && result.error) showToast(result.error, 'error');
  };

  const header = (
    <ScreenHeader
      title="My Cart"
      subtitle={totals.lines.length ? `${totals.lines.length} item(s) · ${kg(totals.totalKg)}` : 'Nothing here yet'}
    />
  );

  if (totals.lines.length === 0) {
    return (
      <Screen safeTop header={header}>
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          message="Browse our rice varieties and order by kilo, half-sack, sack or bulk."
          action="Browse Rice"
          onAction={() => router.navigate('/')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      safeTop
      header={header}
      footer={
        <Button title={`Checkout · ${peso(totals.subtotal - totals.discount)}`} icon="arrow-right" onPress={() => router.push('/checkout')} />
      }
    >
      {totals.lines.map((line) => (
        <Card key={line.key} style={styles.item}>
          <View style={styles.itemTop}>
            <RiceThumb product={line.product} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{line.product.name}</Text>
              <Text style={styles.detail}>
                {unitLabel(line.unit, line.qty)} · {kg(line.kg)}
              </Text>
              <Text style={styles.detail}>{peso(line.pricePerKg)}/kg</Text>
            </View>
            <IconButton icon="trash-can-outline" color={colors.danger} bg={colors.dangerLight} size={18} onPress={() => actions.removeFromCart(line.key)} />
          </View>

          <View style={styles.badges}>
            {line.priceType === 'wholesale' ? <Badge label="Wholesale price" tone="info" icon="store" /> : null}
            {line.discount > 0 ? <Badge label={`${line.ruleName}: -${peso(line.discount)}`} tone="success" icon="tag-outline" /> : null}
          </View>

          <View style={styles.itemBottom}>
            <QuantityStepper value={line.qty} onChange={(q) => changeQty(line.key, q)} min={0} size="sm" />
            <View style={{ alignItems: 'flex-end' }}>
              {line.discount > 0 ? <Text style={styles.strike}>{peso(line.subtotal)}</Text> : null}
              <Text style={styles.total}>{peso(line.total)}</Text>
            </View>
          </View>
        </Card>
      ))}

      <Card>
        <InfoRow label="Subtotal" value={peso(totals.subtotal)} />
        <InfoRow label="Bulk discounts" value={`-${peso(totals.discount)}`} valueStyle={{ color: colors.success }} />
        <InfoRow label="Total weight" value={kg(totals.totalKg)} />
        <View style={styles.sep} />
        <InfoRow label="Total" value={peso(totals.subtotal - totals.discount)} bold />
        <Text style={styles.note}>Delivery fee (if any) is added at checkout.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { marginBottom: spacing.md },
  itemTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  detail: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  strike: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through' },
  total: { fontSize: 17, fontWeight: '800', color: colors.primaryDark },
  sep: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  note: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
