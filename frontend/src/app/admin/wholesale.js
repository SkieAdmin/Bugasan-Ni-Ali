// Admin: wholesale customer management (approve resellers, see their purchases).
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import { Badge, Button, Card, EmptyState, InfoRow, Screen, Segmented } from '../../components';
import { formatDate, initials, kg, peso } from '../../utils/format';
import { confirm } from '../../utils/dialog';
import { colors, spacing } from '../../theme';

export default function WholesaleScreen() {
  const { state, actions, showToast } = useApp();
  const approved = state.users.filter((u) => u.wholesaleStatus === 'approved');
  const pending = state.users.filter((u) => u.wholesaleStatus === 'pending');
  const [tab, setTab] = useState(pending.length ? 'pending' : 'approved');
  const list = tab === 'approved' ? approved : pending;

  // Purchase totals over all orders, worked out by the server (GET /customers).
  const statsFor = (user) => user.stats || { count: 0, total: 0, kg: 0, last: null };

  const approve = async (user) => {
    if ((await actions.setWholesaleStatus(user.id, 'approved')).ok) showToast(`${user.businessName} approved for wholesale`);
  };

  const decline = async (user) => {
    if (await confirm('Decline application?', `${user.businessName} will stay a retail customer.`, 'Decline', true)) {
      if ((await actions.setWholesaleStatus(user.id, null)).ok) showToast('Application declined');
    }
  };

  const revoke = async (user) => {
    if (await confirm('Remove wholesale access?', `${user.businessName} will pay retail prices from now on.`, 'Remove', true)) {
      if ((await actions.setWholesaleStatus(user.id, null)).ok) showToast('Wholesale access removed');
    }
  };

  return (
    <Screen>
      <Segmented
        options={[
          { value: 'approved', label: `Approved (${approved.length})` },
          { value: 'pending', label: `Pending (${pending.length})` },
        ]}
        value={tab}
        onChange={setTab}
        style={{ marginBottom: spacing.lg }}
      />

      {list.length === 0 ? (
        <EmptyState
          icon="store-outline"
          title={tab === 'pending' ? 'No pending applications' : 'No wholesale customers yet'}
          message="Customers can apply for wholesale from their profile or when they register."
        />
      ) : (
        list.map((user) => {
          const stats = statsFor(user);
          return (
            <Card key={user.id} style={styles.card}>
              <View style={styles.top}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(user.businessName || user.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.business}>{user.businessName}</Text>
                  <Text style={styles.owner}>{user.name}</Text>
                </View>
                {tab === 'pending' ? <Badge label="Pending" tone="warning" icon="clock-outline" /> : <Badge label="Active" tone="success" icon="check" />}
              </View>
              <View style={{ marginTop: spacing.sm }}>
                <InfoRow icon="phone-outline" label="Phone" value={user.phone} />
                <InfoRow icon="email-outline" label="Email" value={user.email} />
                <InfoRow icon="map-marker-outline" label="Address" value={user.address} />
              </View>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{stats.count}</Text>
                  <Text style={styles.statLabel}>Orders</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{peso(stats.total, 0)}</Text>
                  <Text style={styles.statLabel}>Purchases</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{kg(stats.kg)}</Text>
                  <Text style={styles.statLabel}>Rice bought</Text>
                </View>
              </View>
              {stats.last ? <Text style={styles.last}>Last order: {formatDate(stats.last)}</Text> : null}
              {tab === 'pending' ? (
                <View style={styles.actions}>
                  <Button title="Decline" variant="danger" size="sm" icon="close" onPress={() => decline(user)} style={{ flex: 1 }} />
                  <Button title="Approve" size="sm" icon="check" onPress={() => approve(user)} style={{ flex: 1 }} />
                </View>
              ) : (
                <Button title="Remove wholesale access" variant="ghost" size="sm" onPress={() => revoke(user)} style={{ marginTop: spacing.sm }} />
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.infoLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: colors.info },
  business: { fontSize: 15.5, fontWeight: '800', color: colors.text },
  owner: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stat: { flex: 1, backgroundColor: colors.bg, borderRadius: 10, paddingVertical: spacing.sm, alignItems: 'center' },
  statValue: { fontSize: 14, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  last: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
