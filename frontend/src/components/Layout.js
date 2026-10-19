// Screen wrappers, headers, bottom-sheet modal and the toast message.
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from '../theme';
import { Icon } from './Basics';
import { useApp } from '../context/AppContext';

// Standard page: optional fixed header, scrollable body and fixed footer (for action buttons).
// When logged in, pulling the page down reloads the data from the server.
export function Screen({ children, header, footer, scroll = true, safeTop = false, contentStyle }) {
  const insets = useSafeAreaInsets();
  const { currentUser, refreshing, actions } = useApp();
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? {
        contentContainerStyle: [styles.content, contentStyle],
        keyboardShouldPersistTaps: 'handled',
        showsVerticalScrollIndicator: false,
        refreshControl: currentUser ? (
          <RefreshControl refreshing={refreshing} onRefresh={actions.refresh} tintColor={colors.primary} colors={[colors.primary]} />
        ) : undefined,
      }
    : { style: [styles.content, { flex: 1 }, contentStyle] };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, safeTop && { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {header}
      <Body style={scroll ? { flex: 1 } : undefined} {...bodyProps}>
        {children}
      </Body>
      {footer ? <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

// Full-screen spinner (app start, data still loading).
export function LoadingScreen({ message }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.loadingText}>{message}</Text> : null}
    </View>
  );
}

// Big title used at the top of tab screens.
export function ScreenHeader({ title, subtitle, right, children }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={font.h1}>{title}</Text>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

// Slide-up sheet used for small forms (add supplier, edit price, etc).
export function ModalSheet({ visible, title, onClose, children, footer }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={font.h2}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose}>
              <Icon name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingTop: spacing.md }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Small message that pops up at the bottom ("Added to cart", etc).
export function Toast() {
  const { toast, hideToast } = useApp();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!toast) return undefined;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => hideToast());
    }, 2200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.key]);

  if (!toast) return null;
  const isError = toast.tone === 'error';
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { bottom: insets.bottom + 90, opacity }]}>
      <Icon name={isError ? 'alert-circle' : 'check-circle'} size={20} color={isError ? '#FFB4AC' : '#9FE0B8'} />
      <Text style={styles.toastText}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.bg },
  loadingText: { ...font.body, color: colors.textMuted, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: 40 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerSubtitle: { ...font.body, color: colors.textMuted, marginTop: 2 },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20, 28, 23, 0.45)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginTop: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  sheetClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.divider, alignItems: 'center', justifyContent: 'center' },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#1D2621',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    maxWidth: '90%',
  },
  toastText: { color: colors.white, fontWeight: '600', fontSize: 14, flexShrink: 1 },
});
