// "Notifications" card, shown on the customer's Profile tab and the admin's More tab.
// Says whether this phone gets notifications, and lets the user switch them on or off
// and send a test one to check.

import { StyleSheet, Switch, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { Button, Card, Icon } from './Basics';
import { useBusy } from '../hooks/useBusy';
import { colors, spacing } from '../theme';

// What each state means, in the words of someone using the app.
const EXPLAIN = {
  checking: 'Checking…',
  on: 'This phone gets a notification for every update.',
  off: 'Turn these on to know about updates without opening the app.',
  unsupported: 'This phone cannot receive notifications.',
};

// When the phone makes its own notifications (no push from the server in this build), they
// are instant only while the app runs; Android decides when the closed app may check.
const EXPLAIN_LOCAL =
  'This phone gets a notification for every update: right away while the app is open, and within about 15 minutes when it is closed.';

const ADMIN_EVENTS = ['New orders and cancellations', 'Wholesale applications', 'Rice that runs low on stock'];
const CUSTOMER_EVENTS = ['Every step of your order', 'Payment confirmations', 'Your wholesale application result'];

export function PushSettings() {
  const { push, currentUser, actions, showToast } = useApp();
  const [busy, run] = useBusy();
  const on = push.status === 'on';
  const unsupported = push.status === 'unsupported';
  const events = currentUser?.role === 'admin' ? ADMIN_EVENTS : CUSTOMER_EVENTS;

  const toggle = (next) =>
    run(async () => {
      if (!next) {
        if ((await actions.disablePush()).ok) showToast('Notifications turned off');
        return;
      }
      const result = await actions.enablePush();
      if (result.ok) showToast('Notifications turned on');
      // enablePush reports why it could not be turned on (permission denied, Expo Go, ...).
      else if (result.error) showToast(result.error, 'error');
    });

  const test = () =>
    run(async () => {
      const result = await actions.sendTestPush();
      if (!result.ok) return;
      showToast(result.sent ? 'Test notification sent' : 'No phone is registered for notifications yet', result.sent ? 'success' : 'error');
    });

  return (
    <Card>
      <View style={styles.head}>
        <Icon name={on ? 'bell-ring-outline' : 'bell-off-outline'} size={22} color={on ? colors.primary : colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Push notifications</Text>
          <Text style={styles.subtitle}>{on && push.mode === 'local' ? EXPLAIN_LOCAL : EXPLAIN[push.status] || EXPLAIN.off}</Text>
        </View>
        <Switch
          value={on}
          onValueChange={toggle}
          disabled={busy || unsupported || push.status === 'checking'}
          trackColor={{ true: colors.primary }}
        />
      </View>

      {/* The reason is only worth showing when the user has just tried to switch them on. */}
      {push.reason && !on ? <Text style={styles.reason}>{push.reason}</Text> : null}

      {on ? (
        <View style={styles.events}>
          {events.map((line) => (
            <View key={line} style={styles.event}>
              <Icon name="check" size={14} color={colors.primary} />
              <Text style={styles.eventText}>{line}</Text>
            </View>
          ))}
          <Button
            title="Send a test notification"
            icon="send-outline"
            variant="ghost"
            size="sm"
            loading={busy}
            onPress={test}
            style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  reason: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
  events: { marginTop: spacing.md, gap: 6 },
  event: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eventText: { fontSize: 12.5, color: colors.textSecondary },
});
