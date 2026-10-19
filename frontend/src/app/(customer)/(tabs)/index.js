// Customer home: rice variety catalog with retail / wholesale prices.
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { Badge, ChipRow, EmptyState, Icon, IconButton, Input, ProductCard, Screen } from '../../../components';
import { describeRule, isWholesaleBuyer, stockStatus } from '../../../utils/pricing';
import { colors, font, radius, spacing } from '../../../theme';

function AccountBadge({ user }) {
  if (isWholesaleBuyer(user)) return <Badge label="Wholesale buyer" tone="info" icon="check-decagram" />;
  if (user.wholesaleStatus === 'pending') return <Badge label="Wholesale pending" tone="warning" icon="clock-outline" />;
  return <Badge label="Retail customer" tone="primary" icon="home-outline" />;
}

export default function ShopScreen() {
  const { state, currentUser } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.products
      .filter((p) => p.active)
      .filter((p) => category === 'All' || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.origin.toLowerCase().includes(q))
      .sort((a, b) => (stockStatus(a) === 'out') - (stockStatus(b) === 'out'));
  }, [state.products, query, category]);

  const rows = [];
  for (let i = 0; i < products.length; i += 2) rows.push(products.slice(i, i + 2));

  const wholesale = isWholesaleBuyer(currentUser);
  const channel = wholesale ? 'wholesale' : 'retail';
  const deals = state.pricingRules.filter((r) => r.active && (r.appliesTo === 'all' || r.appliesTo === channel));
  const firstName = currentUser.name.split(' ')[0];

  return (
    <Screen safeTop>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Magandang araw, {firstName}!</Text>
          <Text style={font.h1}>What rice do you need today?</Text>
        </View>
        <IconButton icon="cart-outline" onPress={() => router.navigate('/cart')} badge={state.cart.length || null} />
      </View>
      <AccountBadge user={currentUser} />

      <Input
        icon="magnify"
        placeholder="Search rice variety or origin"
        value={query}
        onChangeText={setQuery}
        style={{ marginTop: spacing.lg, marginBottom: spacing.md }}
      />

      <View style={[styles.banner, wholesale && styles.bannerWholesale]}>
        <View style={styles.bannerIcon}>
          <Icon name={wholesale ? 'store' : 'sale'} size={24} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{wholesale ? 'Wholesale prices are ON' : 'Buy more, save more'}</Text>
          <Text style={styles.bannerText}>
            {wholesale
              ? 'You get wholesale prices on half-sack, sack and bulk orders.'
              : deals.map((r) => `${describeRule(r).amount} on ${r.minKg}+ kg`).join(' · ') || 'Order by kilo, half-sack, sack or bulk.'}
          </Text>
        </View>
      </View>

      <ChipRow
        options={['All', ...state.categories].map((c) => ({ value: c, label: c }))}
        value={category}
        onChange={setCategory}
        style={{ marginVertical: spacing.lg }}
      />

      {products.length === 0 ? (
        <EmptyState icon="magnify" title="No rice found" message="Try another name or category." />
      ) : (
        rows.map((row) => (
          <View key={row.map((p) => p.id).join('-')} style={styles.row}>
            {row.map((p) => (
              <ProductCard key={p.id} product={p} user={currentUser} onPress={() => router.push(`/product/${p.id}`)} />
            ))}
            {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  hello: { fontSize: 14, color: colors.textMuted, fontWeight: '600', marginBottom: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  bannerWholesale: { backgroundColor: colors.info },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { color: colors.white, fontWeight: '800', fontSize: 15 },
  bannerText: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
});
