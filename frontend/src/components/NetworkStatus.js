// "● Connected" chip at the top-left of every screen, just below the phone's status bar.
// It shows whether the app can reach the backend. Tap it to check again.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../theme';

const STATUS = {
  checking: { label: 'Connecting…', fg: colors.warning, bg: colors.warningLight },
  online: { label: 'Connected', fg: colors.success, bg: colors.successLight },
  offline: { label: 'Offline · tap to retry', fg: colors.danger, bg: colors.dangerLight },
};

export function NetworkStatus() {
  const { connection, recheckConnection } = useApp();
  const insets = useSafeAreaInsets();
  const status = STATUS[connection];

  return (
    <View style={[styles.row, { paddingTop: insets.top + 6 }]}>
      <Pressable
        onPress={recheckConnection}
        hitSlop={8}
        role="button"
        accessibilityLabel={`Network status: ${status.label}`}
        style={({ pressed }) => [styles.chip, { backgroundColor: status.bg }, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.dot, { backgroundColor: status.fg }]} />
        <Text style={[styles.text, { color: status.fg }]}>{status.label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, paddingBottom: 6, backgroundColor: colors.bg, alignItems: 'flex-start' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '700' },
});
