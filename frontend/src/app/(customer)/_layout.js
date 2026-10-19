import { Redirect, Stack } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { LoadingScreen } from '../../components';
import { stackScreenOptions } from '../../theme';

export default function CustomerLayout() {
  const { currentUser, ready } = useApp();

  // Still checking the login saved on this device.
  if (!ready) return <LoadingScreen />;

  // Only logged-in customers can see these screens.
  if (!currentUser) return <Redirect href="/login" />;
  if (currentUser.role === 'admin') return <Redirect href="/admin" />;

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Rice Details' }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order Status' }} />
      <Stack.Screen name="receipt/[id]" options={{ title: 'Digital Receipt' }} />
    </Stack>
  );
}
