// Customer profile: account details, wholesale application and logout.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../../context/AppContext';
import {
  Badge,
  Button,
  Card,
  Icon,
  InfoRow,
  Input,
  ModalSheet,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '../../../components';
import { useBusy } from '../../../hooks/useBusy';
import { isWholesaleBuyer } from '../../../utils/pricing';
import { initials, kg, peso } from '../../../utils/format';
import { confirm } from '../../../utils/dialog';
import { colors, radius, spacing } from '../../../theme';

export default function ProfileScreen() {
  const { state, currentUser, actions, showToast } = useApp();
  const [editing, setEditing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [businessName, setBusinessName] = useState('');
  const [busy, run] = useBusy();

  const orders = state.orders.filter((o) => o.customerId === currentUser.id && o.status !== 'cancelled');
  const spent = orders.reduce((sum, o) => sum + o.total, 0);
  const kilos = orders.reduce((sum, o) => sum + o.totalKg, 0);
  const wholesale = isWholesaleBuyer(currentUser);

  const openEdit = () => {
    setForm({ name: currentUser.name, phone: currentUser.phone, address: currentUser.address });
    setEditing(true);
  };

  const saveProfile = () =>
    run(async () => {
      if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
        showToast('Please fill in all fields', 'error');
        return;
      }
      const result = await actions.updateProfile({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() });
      if (!result.ok) return;
      setEditing(false);
      showToast('Profile updated');
    });

  const apply = () =>
    run(async () => {
      if (!businessName.trim()) {
        showToast('Please enter your business name', 'error');
        return;
      }
      const result = await actions.applyForWholesale(businessName.trim());
      if (!result.ok) return;
      setApplying(false);
      showToast('Wholesale application sent');
    });

  const logout = async () => {
    if (await confirm('Log out?', 'You will need to log in again to order.', 'Log Out')) actions.logout();
  };

  return (
    <Screen safeTop header={<ScreenHeader title="Profile" />}>
      <Card style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(currentUser.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{currentUser.name}</Text>
          <Text style={styles.email}>{currentUser.email}</Text>
          {currentUser.businessName ? <Text style={styles.business}>{currentUser.businessName}</Text> : null}
        </View>
      </Card>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{orders.length}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{peso(spent, 0)}</Text>
          <Text style={styles.statLabel}>Total spent</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{kg(kilos)}</Text>
          <Text style={styles.statLabel}>Rice bought</Text>
        </View>
      </View>

      <SectionHeader title="Account type" />
      {wholesale ? (
        <Card style={{ backgroundColor: colors.infoLight }}>
          <Badge label="Wholesale account active" tone="info" icon="check-decagram" />
          <Text style={styles.wsTitle}>{currentUser.businessName}</Text>
          <Text style={styles.wsText}>• Wholesale price per kg on half-sack, sack and bulk orders</Text>
          <Text style={styles.wsText}>• Extra reseller volume discounts</Text>
          <Text style={styles.wsText}>• Free delivery on orders {peso(state.settings.freeDeliveryMin, 0)}+</Text>
        </Card>
      ) : currentUser.wholesaleStatus === 'pending' ? (
        <Card style={{ backgroundColor: colors.warningLight }}>
          <Badge label="Under review" tone="warning" icon="clock-outline" />
          <Text style={styles.wsTitle}>{currentUser.businessName}</Text>
          <Text style={styles.wsText}>
            The store is reviewing your wholesale application. You can keep ordering at retail prices in the meantime.
          </Text>
        </Card>
      ) : (
        <Card>
          <Badge label="Retail / household" tone="primary" icon="home-outline" />
          <Text style={styles.wsTitle}>Own a store or carinderia?</Text>
          <Text style={styles.wsTextMuted}>
            Apply for a wholesale account to get reseller prices on half-sack, sack and bulk orders.
          </Text>
          <Button
            title="Apply for Wholesale"
            icon="store-plus-outline"
            variant="outline"
            size="sm"
            onPress={() => setApplying(true)}
            style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
          />
        </Card>
      )}

      <SectionHeader title="My details" action="Edit" onAction={openEdit} />
      <Card>
        <InfoRow icon="phone-outline" label="Mobile" value={currentUser.phone} />
        <InfoRow icon="map-marker-outline" label="Address" value={currentUser.address} />
      </Card>

      <SectionHeader title="Store" />
      <Card>
        <View style={styles.storeHead}>
          <Icon name="rice" size={22} color={colors.primary} />
          <Text style={styles.storeName}>{state.store.name}</Text>
        </View>
        <InfoRow icon="map-marker-outline" label="Address" value={state.store.address} />
        <InfoRow icon="clock-outline" label="Hours" value={state.store.hours} />
        <InfoRow icon="phone-outline" label="Contact" value={state.store.phone} />
      </Card>

      <Button title="Log Out" icon="logout" variant="danger" onPress={logout} style={{ marginTop: spacing.xl }} />

      <ModalSheet
        visible={editing}
        title="Edit details"
        onClose={() => setEditing(false)}
        footer={<Button title="Save Changes" icon="content-save-outline" onPress={saveProfile} loading={busy} />}
      >
        <Input label="Full name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
        <Input label="Mobile number" keyboardType="phone-pad" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} />
        <Input label="Delivery address" value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} />
      </ModalSheet>

      <ModalSheet
        visible={applying}
        title="Wholesale application"
        onClose={() => setApplying(false)}
        footer={<Button title="Submit Application" icon="send-outline" onPress={apply} loading={busy} />}
      >
        <Text style={styles.wsTextMuted}>
          Tell us about your business. The store owner will review and approve your wholesale account.
        </Text>
        <Input
          label="Business name"
          placeholder="e.g. Aling Nena Sari-Sari Store"
          value={businessName}
          onChangeText={setBusinessName}
          style={{ marginTop: spacing.lg }}
        />
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  userCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  email: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  business: { fontSize: 13, color: colors.info, fontWeight: '700', marginTop: 2 },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.primaryDark },
  statLabel: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  wsTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: spacing.md, marginBottom: 4 },
  wsText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  wsTextMuted: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  storeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  storeName: { fontSize: 16, fontWeight: '800', color: colors.text },
});
