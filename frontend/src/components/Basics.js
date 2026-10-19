// Small building blocks used on almost every screen.
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { colors, font, radius, shadow, spacing } from '../theme';
import { toneColors } from '../utils/orders';

export function Icon({ name, size = 20, color = colors.text, style }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}

export function Card({ children, style, onPress, padded = true }) {
  const content = [styles.card, padded && styles.cardPadded, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...content, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={content}>{children}</View>;
}

const BUTTON_VARIANTS = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  accent: { bg: colors.accent, fg: colors.white, border: colors.accent },
  secondary: { bg: colors.primaryLight, fg: colors.primaryDark, border: colors.primaryLight },
  outline: { bg: 'transparent', fg: colors.primary, border: colors.primary },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.dangerLight, fg: colors.danger, border: colors.dangerLight },
};

export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, size = 'md', style }) {
  const v = BUTTON_VARIANTS[variant];
  const small = size === 'sm';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      role="button"
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 19} color={v.fg} /> : null}
          <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color = colors.text, bg = colors.card, size = 20, style, badge }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      role="button"
      aria-label={label || icon}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: bg }, pressed && styles.pressed, style]}
    >
      <Icon name={icon} size={size} color={color} />
      {badge ? (
        <View style={styles.iconBadge}>
          <Text style={styles.iconBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Input({ label, error, icon, secure, style, multiline, hint, ...props }) {
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={[styles.inputWrap, style]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <View style={[styles.inputBox, multiline && styles.inputBoxMulti, error && { borderColor: colors.danger }]}>
        {icon ? <Icon name={icon} size={18} color={colors.textMuted} /> : null}
        <TextInput
          style={[styles.input, multiline && styles.inputMulti]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          multiline={multiline}
          {...props}
        />
        {secure ? (
          <Pressable onPress={() => setHidden(!hidden)} hitSlop={8}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.inputError}>{error}</Text> : hint ? <Text style={styles.inputHint}>{hint}</Text> : null}
    </View>
  );
}

export function Badge({ label, tone = 'neutral', icon, style }) {
  const c = toneColors(tone);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      {icon ? <Icon name={icon} size={13} color={c.fg} /> : null}
      <Text style={[styles.badgeText, { color: c.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, icon, count }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      {icon ? <Icon name={icon} size={15} color={selected ? colors.white : colors.textSecondary} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      {count != null ? (
        <View style={[styles.chipCount, selected && styles.chipCountSelected]}>
          <Text style={[styles.chipCountText, selected && { color: colors.primary }]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ options, value, onChange, style }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={styles.chipRow}>
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          icon={o.icon}
          count={o.count}
          selected={o.value === value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </ScrollView>
  );
}

export function Segmented({ options, value, onChange, style }) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function QuantityStepper({ value, onChange, min = 1, max = 999, size = 'md' }) {
  const small = size === 'sm';
  return (
    <View style={[styles.stepper, small && styles.stepperSmall]}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        role="button"
        aria-label="Decrease quantity"
        disabled={value <= min}
        hitSlop={6}
        style={[styles.stepperBtn, small && styles.stepperBtnSmall, value <= min && styles.disabled]}
      >
        <Icon name="minus" size={small ? 16 : 20} color={colors.primary} />
      </Pressable>
      <Text style={[styles.stepperValue, small && styles.stepperValueSmall]}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        role="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        hitSlop={6}
        style={[styles.stepperBtn, small && styles.stepperBtnSmall, value >= max && styles.disabled]}
      >
        <Icon name="plus" size={small ? 16 : 20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export function SectionHeader({ title, action, onAction, style }) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon = 'rice', title, message, action, onAction }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={38} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {action ? <Button title={action} onPress={onAction} style={{ marginTop: spacing.lg, alignSelf: 'center' }} /> : null}
    </View>
  );
}

export function InfoRow({ label, value, valueStyle, bold, icon }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelWrap}>
        {icon ? <Icon name={icon} size={16} color={colors.textMuted} /> : null}
        <Text style={[styles.infoLabel, bold && styles.infoBold]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, bold && styles.infoBold, valueStyle]}>{value}</Text>
    </View>
  );
}

export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

export function ListRow({ icon, title, subtitle, onPress, right, tone = 'primary', last }) {
  const c = toneColors(tone);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listRow, !last && styles.listRowBorder, pressed && styles.pressed]}>
      {icon ? (
        <View style={[styles.listIcon, { backgroundColor: c.bg }]}>
          <Icon name={icon} size={20} color={c.fg} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.listTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <Icon name="chevron-right" size={22} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

export function RiceThumb({ product, size = 56 }) {
  const tint = product?.tint || colors.primary;
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: `${tint}1F` }]}>
      <Icon name="rice" size={size * 0.52} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, ...shadow },
  cardPadded: { padding: spacing.lg },

  button: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  buttonText: { fontSize: 15, fontWeight: '700' },
  buttonTextSmall: { fontSize: 13 },

  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  iconBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },

  inputWrap: { marginBottom: spacing.md },
  inputLabel: { ...font.label, marginBottom: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputBoxMulti: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 10, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  inputError: { color: colors.danger, fontSize: 12, marginTop: 4 },
  inputHint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11.5, fontWeight: '700' },

  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextSelected: { color: colors.white },
  chipCount: { backgroundColor: colors.divider, borderRadius: 9, paddingHorizontal: 6, minWidth: 20, alignItems: 'center' },
  chipCountSelected: { backgroundColor: colors.white },
  chipCountText: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },

  segmented: { flexDirection: 'row', backgroundColor: colors.divider, borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.card, ...shadow },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: colors.primaryDark, fontWeight: '700' },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: 4,
  },
  stepperSmall: { borderRadius: radius.sm, padding: 2 },
  stepperBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  stepperBtnSmall: { width: 30, height: 30, borderRadius: 7 },
  stepperValue: { minWidth: 44, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.primaryDark },
  stepperValueSmall: { minWidth: 32, fontSize: 14 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...font.h3, fontSize: 17 },
  sectionAction: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...font.h3, textAlign: 'center' },
  emptyMessage: { ...font.body, color: colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6, gap: spacing.md },
  infoLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  infoLabel: { fontSize: 14, color: colors.textSecondary },
  infoValue: { fontSize: 14, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  infoBold: { fontSize: 16, fontWeight: '800', color: colors.text },

  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  listIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  listSubtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },

  thumb: { alignItems: 'center', justifyContent: 'center' },
});
