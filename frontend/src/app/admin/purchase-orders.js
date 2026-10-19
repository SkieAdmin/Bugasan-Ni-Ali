// Admin: purchase order records (restocking from suppliers).
import { useState } from 'react';
import { Stack, router } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { ChipRow, EmptyState, IconButton, PurchaseOrderCard, Screen } from '../../components';
import { colors, spacing } from '../../theme';

export default function PurchaseOrdersScreen() {
  const { state } = useApp();
  const [filter, setFilter] = useState('all');
  const list = state.purchaseOrders.filter((p) => filter === 'all' || p.status === filter);
  const count = (status) => state.purchaseOrders.filter((p) => status === 'all' || p.status === status).length;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton icon="plus" bg={colors.primary} color={colors.white} onPress={() => router.push('/admin/purchase-order/new')} />
          ),
        }}
      />
      <ChipRow
        options={[
          { value: 'all', label: 'All', count: count('all') },
          { value: 'ordered', label: 'Awaiting delivery', count: count('ordered') },
          { value: 'received', label: 'Received', count: count('received') },
          { value: 'cancelled', label: 'Cancelled', count: count('cancelled') },
        ]}
        value={filter}
        onChange={setFilter}
        style={{ marginBottom: spacing.lg }}
      />
      {list.length === 0 ? (
        <EmptyState icon="clipboard-text-outline" title="No purchase orders" action="Create Purchase Order" onAction={() => router.push('/admin/purchase-order/new')} />
      ) : (
        list.map((po) => <PurchaseOrderCard key={po.id} po={po} onPress={() => router.push(`/admin/purchase-order/${po.id}`)} />)
      )}
    </Screen>
  );
}
