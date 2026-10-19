import { Redirect, Stack } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { LoadingScreen } from '../../components';
import { stackScreenOptions } from '../../theme';

export default function AdminLayout() {
  const { currentUser, ready } = useApp();

  // Still checking the login saved on this device.
  if (!ready) return <LoadingScreen />;

  // Only the store admin can open these screens.
  if (!currentUser) return <Redirect href="/login" />;
  if (currentUser.role !== 'admin') return <Redirect href="/" />;

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Manage Order' }} />
      <Stack.Screen name="receipt/[id]" options={{ title: 'Digital Receipt' }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Stock & Pricing' }} />
      <Stack.Screen name="product/new" options={{ title: 'Add Rice Variety' }} />
      <Stack.Screen name="suppliers" options={{ title: 'Suppliers' }} />
      <Stack.Screen name="supplier/[id]" options={{ title: 'Supplier' }} />
      <Stack.Screen name="purchase-orders" options={{ title: 'Purchase Orders' }} />
      <Stack.Screen name="purchase-order/new" options={{ title: 'New Purchase Order' }} />
      <Stack.Screen name="purchase-order/[id]" options={{ title: 'Purchase Order' }} />
      <Stack.Screen name="wholesale" options={{ title: 'Wholesale Customers' }} />
      <Stack.Screen name="pricing" options={{ title: 'Pricing & Discounts' }} />
    </Stack>
  );
}
