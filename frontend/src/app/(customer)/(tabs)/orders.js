// Customer order history.
import { useState } from 'react';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { ChipRow, EmptyState, OrderCard, Screen, ScreenHeader } from '../../../components';
import { isActive, isCompleted } from '../../../utils/orders';
import { spacing } from '../../../theme';

const FILTERS = {
  active: isActive,
  completed: isCompleted,
  cancelled: (o) => o.status === 'cancelled',
  all: () => true,
};

export default function OrdersScreen() {
  const { state, currentUser } = useApp();
  const mine = state.orders.filter((o) => o.customerId === currentUser.id);
  const [filter, setFilter] = useState('active');
  const list = mine.filter(FILTERS[filter]);

  const options = [
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'all', label: 'All' },
  ].map((o) => ({ ...o, count: mine.filter(FILTERS[o.value]).length }));

  return (
    <Screen
      safeTop
      header={
        <ScreenHeader title="My Orders" subtitle="Track deliveries and view past purchases">
          <ChipRow options={options} value={filter} onChange={setFilter} style={{ marginTop: spacing.md }} />
        </ScreenHeader>
      }
    >
      {list.length === 0 ? (
        <EmptyState
          icon="clipboard-text-outline"
          title={filter === 'active' ? 'No active orders' : 'No orders here'}
          message="When you order rice, you can follow its status here."
          action="Shop Rice"
          onAction={() => router.navigate('/')}
        />
      ) : (
        list.map((order) => <OrderCard key={order.id} order={order} onPress={() => router.push(`/order/${order.id}`)} />)
      )}
    </Screen>
  );
}
