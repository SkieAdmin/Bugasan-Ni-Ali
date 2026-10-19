// Admin: all customer orders with filters and search.
import { useState } from 'react';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { useParamFilter } from '../../../hooks/useParamFilter';
import { ChipRow, EmptyState, Input, OrderCard, Screen, ScreenHeader } from '../../../components';
import { isCompleted } from '../../../utils/orders';
import { spacing } from '../../../theme';

const IN_PROGRESS = ['confirmed', 'preparing', 'out_for_delivery', 'ready_for_pickup'];

const FILTERS = {
  all: () => true,
  pending: (o) => o.status === 'pending',
  progress: (o) => IN_PROGRESS.includes(o.status),
  completed: isCompleted,
  unpaid: (o) => o.status !== 'cancelled' && o.paymentStatus !== 'paid',
  cancelled: (o) => o.status === 'cancelled',
};

const LABELS = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['progress', 'In progress'],
  ['completed', 'Completed'],
  ['unpaid', 'Unpaid'],
  ['cancelled', 'Cancelled'],
];

export default function AdminOrdersScreen() {
  const { state } = useApp();
  // The dashboard can open this tab with a filter already chosen.
  const [filter, setFilter] = useParamFilter('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const list = state.orders
    .filter(FILTERS[filter] || FILTERS.all)
    .filter((o) => !q || o.id.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q));

  const options = LABELS.map(([value, label]) => ({ value, label, count: state.orders.filter(FILTERS[value]).length }));

  return (
    <Screen
      safeTop
      header={
        <ScreenHeader title="Orders" subtitle="Customer orders, payments and deliveries">
          <Input
            icon="magnify"
            placeholder="Search order no. or customer"
            value={query}
            onChangeText={setQuery}
            style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
          />
          <ChipRow options={options} value={filter} onChange={setFilter} />
        </ScreenHeader>
      }
    >
      {list.length === 0 ? (
        <EmptyState icon="clipboard-text-outline" title="No orders found" message="Try a different filter or search." />
      ) : (
        list.map((o) => <OrderCard key={o.id} order={o} admin onPress={() => router.push(`/admin/order/${o.id}`)} />)
      )}
    </Screen>
  );
}
