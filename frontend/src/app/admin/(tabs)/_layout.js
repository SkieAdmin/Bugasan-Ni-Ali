import { Tabs } from 'expo-router/js-tabs';
import { useApp } from '../../../context/AppContext';
import { Icon } from '../../../components';
import { tabScreenOptions } from '../../../theme';
import { stockStatus } from '../../../utils/pricing';

export default function AdminTabs() {
  const { state } = useApp();
  const pending = state.orders.filter((o) => o.status === 'pending').length;
  const lowStock = state.products.filter((p) => p.active && stockStatus(p) !== 'ok').length;

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Icon name="view-dashboard-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarBadge: pending || undefined,
          tabBarIcon: ({ color, size }) => <Icon name="clipboard-list-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarBadge: lowStock || undefined,
          tabBarIcon: ({ color, size }) => <Icon name="warehouse" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <Icon name="chart-box-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Icon name="dots-horizontal-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
