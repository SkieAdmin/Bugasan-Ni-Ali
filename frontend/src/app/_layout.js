import { useMemo } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaInsetsContext, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProvider } from '../context/AppContext';
import { NetworkStatus, Toast } from '../components';
import { colors } from '../theme';

// The network status row already sits below the phone's status bar, so the screens under it
// must not add the status bar height again.
function BelowStatusRow({ children }) {
  const insets = useSafeAreaInsets();
  const value = useMemo(() => ({ ...insets, top: 0 }), [insets]);
  return <SafeAreaInsetsContext.Provider value={value}>{children}</SafeAreaInsetsContext.Provider>;
}

// Root of the app. Three areas live under it:
//   (auth)      -> login & register
//   (customer)  -> shop, cart, orders, profile
//   admin       -> store management
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <NetworkStatus />
          <BelowStatusRow>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
          </BelowStatusRow>
        </View>
        <Toast />
      </AppProvider>
    </SafeAreaProvider>
  );
}
