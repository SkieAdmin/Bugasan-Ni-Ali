// Rice variety details: prices, unit (kilo / half-sack / sack / bulk), quantity and add to cart.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  InfoRow,
  QuantityStepper,
  RiceThumb,
  Screen,
  SectionHeader,
  StockBadge,
} from '../../../components';
import { UNIT_LIST, describeRule, getChannel, getPricePerKg, isWholesaleBuyer, priceLine } from '../../../utils/pricing';
import { kg, peso } from '../../../utils/format';
import { colors, font, radius, spacing } from '../../../theme';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const { state, currentUser, actions, showToast } = useApp();
  const product = state.products.find((p) => p.id === id);
  const [unit, setUnit] = useState(() => (product && product.stockKg >= 50 ? 'sack' : 'kilo'));
  const [qty, setQty] = useState(1);

  if (!product) return <EmptyState title="Rice variety not found" />;

  const inCartKg = actions.cartKgFor(product.id);
  const availableKg = Math.max(0, product.stockKg - inCartKg);
  const unitKg = UNIT_LIST.find((u) => u.key === unit).kg;
  const maxQty = Math.floor(availableKg / unitKg);
  const canBuy = maxQty >= 1;
  const safeQty = Math.min(qty, Math.max(1, maxQty));
  const line = priceLine(product, unit, safeQty, currentUser, state.pricingRules);
  const wholesale = isWholesaleBuyer(currentUser);
  const channel = getChannel(currentUser);
  const deals = state.pricingRules.filter((r) => r.active && (r.appliesTo === 'all' || r.appliesTo === channel));

  const chooseUnit = (key) => {
    setUnit(key);
    setQty(1);
  };

  const addToCart = () => {
    const result = actions.addToCart(product.id, unit, safeQty);
    if (result.ok) {
      showToast(`${product.name} added to cart`);
      setQty(1);
    } else {
      showToast(result.error, 'error');
    }
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.footerLabel}>{kg(line.kg)} total</Text>
            <Text style={styles.footerTotal}>{peso(line.total)}</Text>
          </View>
          <IconButton icon="cart-outline" bg={colors.primaryLight} color={colors.primary} onPress={() => router.navigate('/cart')} badge={state.cart.length || null} />
          <Button
            title={canBuy ? 'Add to Cart' : 'Not available'}
            icon="cart-plus"
            onPress={addToCart}
            disabled={!canBuy}
            style={{ flex: 1.3 }}
          />
        </View>
      }
    >
      <View style={styles.hero}>
        <RiceThumb product={product} size={104} />
        <View style={{ flex: 1 }}>
          <Text style={font.h2}>{product.name}</Text>
          <Text style={styles.origin}>
            {product.category} · {product.origin}
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <StockBadge product={product} showKg />
          </View>
        </View>
      </View>
      <Text style={styles.description}>{product.description}</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={styles.priceHead}>
          <View style={[styles.priceBox, !wholesale && styles.priceBoxActive]}>
            <Text style={styles.priceLabel}>Retail</Text>
            <Text style={styles.priceValue}>{peso(product.retailPrice)}</Text>
            <Text style={styles.priceUnit}>per kilo</Text>
          </View>
          <View style={[styles.priceBox, wholesale && styles.priceBoxActive]}>
            <Text style={styles.priceLabel}>Wholesale</Text>
            <Text style={styles.priceValue}>{peso(product.wholesalePrice)}</Text>
            <Text style={styles.priceUnit}>per kilo</Text>
          </View>
        </View>
        <Text style={styles.priceNote}>
          {wholesale
            ? 'Your wholesale account gets the wholesale price on half-sack, sack and bulk orders.'
            : 'Wholesale prices are for approved reseller accounts (half-sack and up).'}
        </Text>
      </Card>

      <SectionHeader title="How do you want to buy?" />
      <View style={styles.unitGrid}>
        {UNIT_LIST.map((u) => {
          const active = u.key === unit;
          const { pricePerKg } = getPricePerKg(product, u.key, currentUser);
          const possible = availableKg >= u.kg;
          return (
            <Pressable
              key={u.key}
              onPress={() => possible && chooseUnit(u.key)}
              style={[styles.unit, active && styles.unitActive, !possible && { opacity: 0.4 }]}
            >
              <View style={styles.unitTop}>
                <Text style={[styles.unitName, active && { color: colors.primaryDark }]}>{u.label}</Text>
                <Icon name={active ? 'check-circle' : 'circle-outline'} size={18} color={active ? colors.primary : colors.border} />
              </View>
              <Text style={styles.unitKg}>{u.key === 'bulk' ? '10 sacks · 500 kg' : u.key === 'kilo' ? '1 kg' : `${u.kg} kg`}</Text>
              <Text style={styles.unitPrice}>{peso(pricePerKg * u.kg, 0)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <View style={styles.qtyRow}>
          <View>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <Text style={styles.qtyHint}>{canBuy ? `Up to ${maxQty} available` : 'Not enough stock'}</Text>
          </View>
          <QuantityStepper value={safeQty} onChange={setQty} max={Math.max(1, maxQty)} />
        </View>
        <View style={styles.summary}>
          <InfoRow label={`${kg(line.kg)} × ${peso(line.pricePerKg)}/kg`} value={peso(line.subtotal)} />
          {line.discount > 0 ? (
            <InfoRow label={`${line.ruleName} discount`} value={`-${peso(line.discount)}`} valueStyle={{ color: colors.success }} />
          ) : null}
          <InfoRow label="Item total" value={peso(line.total)} bold />
          {line.priceType === 'wholesale' ? <Text style={styles.wholesaleTag}>Wholesale price applied</Text> : null}
        </View>
      </Card>

      {deals.length ? (
        <>
          <SectionHeader title="Bulk discounts" />
          <Card>
            {deals.map((r, i) => (
              <View key={r.id} style={[styles.deal, i > 0 && styles.dealBorder]}>
                <Icon name="tag-outline" size={18} color={colors.accent} />
                <Text style={styles.dealName}>{r.name}</Text>
                <Text style={styles.dealText}>
                  {describeRule(r).amount} · {r.minKg}+ kg
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  origin: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  description: { ...font.body, color: colors.textSecondary, lineHeight: 21, marginTop: spacing.lg },
  priceHead: { flexDirection: 'row', gap: spacing.md },
  priceBox: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: 'transparent' },
  priceBoxActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  priceLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  priceValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 },
  priceUnit: { fontSize: 12, color: colors.textMuted },
  priceNote: { fontSize: 12.5, color: colors.textMuted, marginTop: spacing.md, lineHeight: 18 },
  unitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  unit: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  unitActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  unitTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  unitName: { fontSize: 15, fontWeight: '800', color: colors.text },
  unitKg: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  unitPrice: { fontSize: 16, fontWeight: '800', color: colors.primaryDark, marginTop: spacing.sm },
  qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qtyLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  qtyHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  summary: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  wholesaleTag: { fontSize: 12, color: colors.info, fontWeight: '700', marginTop: 4 },
  deal: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  dealBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  dealName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  dealText: { fontSize: 13, color: colors.textSecondary },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footerLabel: { fontSize: 12, color: colors.textMuted },
  footerTotal: { fontSize: 20, fontWeight: '800', color: colors.primaryDark },
});
