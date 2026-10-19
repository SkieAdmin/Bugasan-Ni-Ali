import { Tabs } from 'expo-router/js-tabs';
import { useApp } from '../../../context/AppContext';
import { Icon } from '../../../components';
import { tabScreenOptions } from '../../../theme';
import { isActive } from '../../../utils/orders';

export default function CustomerTabs() {
  const { state, currentUser } = useApp();
  const cartCount = state.cart.length;
  const activeOrders = state.orders.filter((o) => o.customerId === currentUser?.id && isActive(o)).length;

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => <Icon name="storefront-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarBadge: cartCount || undefined,
          tabBarIcon: ({ color, size }) => <Icon name="cart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'My Orders',
          tabBarBadge: activeOrders || undefined,
          tabBarIcon: ({ color, size }) => <Icon name="clipboard-text-clock-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Icon name="account-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
