// Product (rice variety) pieces used in the catalog and inventory.
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Badge, Card, RiceThumb } from './Basics';
import { isWholesaleBuyer, stockStatus } from '../utils/pricing';
import { kg, peso } from '../utils/format';

export function StockBadge({ product, showKg }) {
  const status = stockStatus(product);
  if (status === 'out') return <Badge label="Out of stock" tone="danger" icon="close-circle-outline" />;
  if (status === 'low') return <Badge label={showKg ? `Low · ${kg(product.stockKg)}` : 'Low stock'} tone="warning" icon="alert-outline" />;
  return <Badge label={showKg ? kg(product.stockKg) : 'In stock'} tone="success" icon="check" />;
}

export function ProductCard({ product, user, onPress, style }) {
  const wholesale = isWholesaleBuyer(user);
  return (
    <Card onPress={onPress} style={[styles.card, style]}>
      <RiceThumb product={product} size={64} />
      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={styles.origin} numberOfLines={1}>
        {product.category} · {product.origin}
      </Text>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{peso(product.retailPrice, 0)}</Text>
        <Text style={styles.per}>/kg</Text>
      </View>
      {wholesale ? (
        <Text style={styles.wholesale}>Wholesale {peso(product.wholesalePrice, 0)}/kg</Text>
      ) : (
        <Text style={styles.sack}>{peso(product.retailPrice * 50, 0)} / sack</Text>
      )}

      <View style={{ marginTop: spacing.sm }}>
        <StockBadge product={product} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: spacing.md, minHeight: 38 },
  origin: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm },
  price: { fontSize: 19, fontWeight: '800', color: colors.primaryDark },
  per: { fontSize: 12, color: colors.textMuted, marginLeft: 2 },
  wholesale: { fontSize: 12, color: colors.info, fontWeight: '700', marginTop: 1 },
  sack: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
