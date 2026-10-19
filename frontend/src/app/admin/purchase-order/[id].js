// Admin: one purchase order — receive the stock or cancel it.
import { StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { Badge, Button, Card, EmptyState, InfoRow, RiceThumb, Screen, SectionHeader } from '../../../components';
import { PO_STATUS } from '../../../utils/orders';
import { formatDate, formatDateTime, kg, peso } from '../../../utils/format';
import { confirm } from '../../../utils/dialog';
import { useBusy } from '../../../hooks/useBusy';
import { colors, spacing } from '../../../theme';

export default function PurchaseOrderScreen() {
  const { id } = useLocalSearchParams();
  const { state, actions, showToast } = useApp();
  const [busy, run] = useBusy();
  const po = state.purchaseOrders.find((p) => p.id === id);

  if (!po) return <EmptyState title="Purchase order not found" />;

  const meta = PO_STATUS[po.status];
  const supplier = state.suppliers.find((s) => s.id === po.supplierId);

  const receive = () =>
    run(async () => {
      const ok = await confirm('Receive this delivery?', `${kg(po.totalKg)} of rice will be added to inventory.`, 'Receive Stock');
      if (ok && (await actions.receivePurchaseOrder(po.id)).ok) showToast(`Stock updated · +${kg(po.totalKg)}`);
    });

  const cancel = () =>
    run(async () => {
      const ok = await confirm('Cancel purchase order?', `${po.id} to ${po.supplierName} will be cancelled.`, 'Cancel PO', true);
      if (ok && (await actions.cancelPurchaseOrder(po.id)).ok) showToast('Purchase order cancelled');
    });

  return (
    <Screen
      footer={
        po.status === 'ordered' ? (
          <View style={{ gap: spacing.sm }}>
            <Button title="Mark as Received · Add to Stock" icon="package-variant-closed-check" onPress={receive} loading={busy} />
            <Button title="Cancel Purchase Order" icon="close-circle-outline" variant="danger" onPress={cancel} disabled={busy} />
          </View>
        ) : null
      }
    >
      <Stack.Screen options={{ title: po.id }} />
      <Card>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.id}>{po.id}</Text>
            <Text style={styles.sub}>{po.supplierName}</Text>
          </View>
          <Badge label={meta.label} tone={meta.tone} icon={meta.icon} />
        </View>
        <View style={styles.sep} />
        <InfoRow icon="calendar-arrow-right" label="Ordered" value={formatDateTime(po.orderedAt)} />
        <InfoRow icon="calendar-clock" label="Expected" value={formatDate(po.expectedAt)} />
        {po.receivedAt ? <InfoRow icon="calendar-check" label="Received" value={formatDateTime(po.receivedAt)} /> : null}
        {po.notes ? <InfoRow icon="note-text-outline" label="Notes" value={po.notes} /> : null}
      </Card>

      <SectionHeader title="Items" />
      <Card>
        {po.items.map((item, i) => {
          const product = state.products.find((p) => p.id === item.productId);
          return (
            <View key={item.productId} style={[styles.item, i > 0 && styles.itemBorder]}>
              <RiceThumb product={product} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSub}>
                  {item.sacks} sacks · {kg(item.kg)} @ {peso(item.costPerKg)}/kg
                </Text>
              </View>
              <Text style={styles.itemTotal}>{peso(item.total, 0)}</Text>
            </View>
          );
        })}
        <View style={styles.sep} />
        <InfoRow label="Total weight" value={kg(po.totalKg)} />
        <InfoRow label="Total cost" value={peso(po.totalCost)} bold />
      </Card>

      {supplier ? (
        <>
          <SectionHeader title="Supplier" action="View" onAction={() => router.push(`/admin/supplier/${supplier.id}`)} />
          <Card>
            <InfoRow icon="account-tie-outline" label="Contact" value={supplier.contactPerson} />
            <InfoRow icon="phone-outline" label="Phone" value={supplier.phone} />
            <InfoRow icon="map-marker-outline" label="Address" value={supplier.address} />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  id: { fontSize: 20, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  sep: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: colors.text },
});
