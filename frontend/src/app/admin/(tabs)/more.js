// Admin: menu for the other store-management screens + logout.
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { Badge, Button, Card, InfoRow, ListRow, Screen, ScreenHeader, SectionHeader } from '../../../components';
import { initials } from '../../../utils/format';
import { confirm } from '../../../utils/dialog';
import { colors, spacing } from '../../../theme';

export default function MoreScreen() {
  const { state, currentUser, actions } = useApp();
  const openPOs = state.purchaseOrders.filter((p) => p.status === 'ordered').length;
  const pendingWholesale = state.users.filter((u) => u.wholesaleStatus === 'pending').length;
  const activeRules = state.pricingRules.filter((r) => r.active).length;

  const logout = async () => {
    if (await confirm('Log out?', 'You will return to the login screen.', 'Log Out')) actions.logout();
  };

  return (
    <Screen safeTop header={<ScreenHeader title="More" />}>
      <Card style={styles.user}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(currentUser.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{currentUser.name}</Text>
          <Text style={styles.email}>{currentUser.email}</Text>
        </View>
        <Badge label="Store Admin" tone="primary" icon="shield-account" />
      </Card>

      <SectionHeader title="Store management" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <ListRow
          icon="truck-outline"
          title="Suppliers"
          subtitle={`${state.suppliers.length} suppliers · restocking`}
          onPress={() => router.push('/admin/suppliers')}
        />
        <ListRow
          icon="clipboard-arrow-down-outline"
          title="Purchase Orders"
          subtitle="Record supplier purchases"
          tone="info"
          right={openPOs ? <Badge label={`${openPOs} open`} tone="info" /> : null}
          onPress={() => router.push('/admin/purchase-orders')}
        />
        <ListRow
          icon="store-outline"
          title="Wholesale Customers"
          subtitle="Approve and manage resellers"
          tone="accent"
          right={pendingWholesale ? <Badge label={`${pendingWholesale} new`} tone="warning" /> : null}
          onPress={() => router.push('/admin/wholesale')}
        />
        <ListRow
          icon="tag-multiple-outline"
          title="Pricing & Discounts"
          subtitle={`Price list · ${activeRules} active bulk rules · delivery fee`}
          onPress={() => router.push('/admin/pricing')}
        />
        <ListRow icon="warehouse" title="Add Rice Variety" subtitle="Add a new product to the catalog" tone="neutral" onPress={() => router.push('/admin/product/new')} last />
      </Card>

      <SectionHeader title="Store information" />
      <Card>
        <InfoRow icon="store-outline" label="Name" value={state.store.name} />
        <InfoRow icon="map-marker-outline" label="Address" value={state.store.address} />
        <InfoRow icon="clock-outline" label="Hours" value={state.store.hours} />
        <InfoRow icon="phone-outline" label="Phone" value={state.store.phone} />
        <InfoRow icon="cellphone" label="GCash" value={state.store.gcash} />
        <InfoRow icon="bank-outline" label="Bank" value={state.store.bank} />
      </Card>

      <Button title="Log Out" icon="logout" variant="danger" onPress={logout} style={{ marginTop: spacing.xl }} />
      <Text style={styles.version}>Bugasan ni Ali · Frontend prototype v1.0 (mock data)</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  user: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 19, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  email: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  version: { textAlign: 'center', fontSize: 11.5, color: colors.textMuted, marginTop: spacing.lg },
});
