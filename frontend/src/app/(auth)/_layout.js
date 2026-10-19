import { Redirect, Stack } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { LoadingScreen } from '../../components';
import { colors } from '../../theme';

export default function AuthLayout() {
  const { currentUser, ready } = useApp();

  // Still checking the login saved on this device.
  if (!ready) return <LoadingScreen />;

  // Already logged in? Send the user to their home screen.
  if (currentUser) {
    return <Redirect href={currentUser.role === 'admin' ? '/admin' : '/'} />;
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
