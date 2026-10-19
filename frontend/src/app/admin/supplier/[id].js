// Admin: supplier details and purchase history.
import { StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { Badge, Button, Card, EmptyState, InfoRow, PurchaseOrderCard, Screen, SectionHeader, StatCard } from '../../../components';
import { kg, peso, sacks } from '../../../utils/format';
import { colors, spacing } from '../../../theme';

export default function SupplierDetailScreen() {
  const { id } = useLocalSearchParams();
  const { state } = useApp();
  const supplier = state.suppliers.find((s) => s.id === id);

  if (!supplier) return <EmptyState title="Supplier not found" />;

  const pos = state.purchaseOrders.filter((p) => p.supplierId === supplier.id);
  const valid = pos.filter((p) => p.status !== 'cancelled');
  const spent = valid.reduce((s, p) => s + p.totalCost, 0);
  const delivered = valid.filter((p) => p.status === 'received').reduce((s, p) => s + p.totalKg, 0);

  return (
    <Screen
      footer={
        <Button
          title="New Purchase Order"
          icon="clipboard-plus-outline"
          onPress={() => router.push({ pathname: '/admin/purchase-order/new', params: { supplierId: supplier.id } })}
        />
      }
    >
      <Stack.Screen options={{ title: supplier.name }} />
      <Card>
        <Text style={styles.name}>{supplier.name}</Text>
        <InfoRow icon="account-tie-outline" label="Contact" value={supplier.contactPerson} />
        <InfoRow icon="phone-outline" label="Phone" value={supplier.phone} />
        {supplier.email ? <InfoRow icon="email-outline" label="Email" value={supplier.email} /> : null}
        <InfoRow icon="map-marker-outline" label="Address" value={supplier.address} />
        <InfoRow icon="timer-sand" label="Lead time" value={`${supplier.leadTimeDays} days`} />
        <View style={styles.varieties}>
          {supplier.varietyIds.map((vid) => {
            const p = state.products.find((x) => x.id === vid);
            return p ? <Badge key={vid} label={p.name} tone="primary" icon="rice" /> : null;
          })}
        </View>
      </Card>

      <View style={styles.stats}>
        <StatCard icon="cash-multiple" label="Total purchases" value={peso(spent, 0)} sub={`${valid.length} purchase orders`} />
        <StatCard icon="weight-kilogram" label="Rice delivered" value={kg(delivered)} sub={sacks(delivered)} tone="info" />
      </View>

      <SectionHeader title="Purchase history" />
      {pos.length === 0 ? (
        <EmptyState icon="clipboard-text-outline" title="No purchase orders yet" />
      ) : (
        pos.map((po) => <PurchaseOrderCard key={po.id} po={po} hideSupplier onPress={() => router.push(`/admin/purchase-order/${po.id}`)} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 19, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  varieties: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
