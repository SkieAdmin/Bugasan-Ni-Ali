// Lightweight charts built from plain Views (no chart library needed).
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Card, Icon } from './Basics';
import { toneColors } from '../utils/orders';

export function StatCard({ icon, label, value, sub, tone = 'primary', onPress, style }) {
  const c = toneColors(tone);
  return (
    <Card onPress={onPress} style={[styles.stat, style]}>
      <View style={[styles.statIcon, { backgroundColor: c.bg }]}>
        <Icon name={icon} size={19} color={c.fg} />
      </View>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={styles.statSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}

// Horizontal bars, one row per item (e.g. best-selling varieties).
export function BarList({ data, color = colors.chartRetail, max }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ gap: spacing.md }}>
      {data.map((d) => (
        <View key={d.key}>
          <View style={styles.barLabelRow}>
            <View style={styles.barLabelLeft}>
              {d.rank ? <Text style={styles.rank}>{d.rank}</Text> : null}
              <Text style={styles.barLabel} numberOfLines={1}>
                {d.label}
              </Text>
              {d.icon ? <Icon name={d.icon} size={15} color={d.iconColor || colors.textMuted} /> : null}
            </View>
            <Text style={styles.barValue}>{d.valueLabel}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(1.5, (d.value / top) * 100)}%`, backgroundColor: color }]} />
          </View>
          {d.sub ? <Text style={styles.barSub}>{d.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

// Vertical bars over time. Tap a bar to read its value.
export function ColumnChart({ data, formatValue, color = colors.chartRetail, height = 150, hint = 'Tap a bar to see its value' }) {
  const [selected, setSelected] = useState(null);
  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const labelEvery = Math.ceil(data.length / 6);
  const active = selected != null ? data[selected] : null;

  return (
    <View>
      <View style={styles.readout}>
        {active ? (
          <>
            <Text style={styles.readoutLabel}>{active.longLabel || active.label}</Text>
            <Text style={styles.readoutValue}>{formatValue(active.value)}</Text>
          </>
        ) : (
          <Text style={styles.readoutHint}>{hint}</Text>
        )}
      </View>

      <View style={styles.axisTop}>
        <Text style={styles.axisText}>{formatValue(maxValue)}</Text>
        <View style={styles.gridline} />
      </View>

      <View style={[styles.columns, { height }]}>
        {data.map((d, i) => {
          const isSelected = i === selected;
          const barHeight = d.value > 0 ? Math.max(3, (d.value / maxValue) * height) : 0;
          return (
            <Pressable
              key={d.key}
              onPress={() => setSelected(isSelected ? null : i)}
              style={styles.columnHit}
              aria-label={`${d.longLabel || d.label}: ${formatValue(d.value)}`}
            >
              <View
                style={[
                  styles.column,
                  {
                    height: barHeight,
                    backgroundColor: color,
                    opacity: selected == null || isSelected ? 1 : 0.35,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.baseline} />

      <View style={styles.xLabels}>
        {data.map((d, i) => {
          const isLast = i === data.length - 1;
          if (!isLast && (i % labelEvery !== 0 || data.length - 1 - i < labelEvery / 2)) return null;
          const position = isLast ? { right: 0 } : { left: `${(i / data.length) * 100}%` };
          return (
            <Text key={d.key} style={[styles.xLabel, position]} numberOfLines={1}>
              {d.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

// One bar split into parts that add up to 100% (e.g. retail vs wholesale), with a legend.
export function ShareBar({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  return (
    <View>
      <View style={styles.shareBar}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <View key={s.key} style={[styles.shareSegment, { flex: s.value, backgroundColor: s.color }]} />
          ))}
      </View>
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {segments.map((s) => (
          <View key={s.key} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
            <Text style={styles.legendPct}>{Math.round((s.value / total) * 100)}%</Text>
            <Text style={styles.legendValue}>{s.valueLabel}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, padding: spacing.md, minWidth: 140 },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  statLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  statValue: { fontSize: 21, fontWeight: '800', color: colors.text, marginTop: 2 },
  statSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },

  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: spacing.sm },
  barLabelLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  rank: { fontSize: 12, fontWeight: '800', color: colors.textMuted, width: 16 },
  barLabel: { fontSize: 13.5, fontWeight: '600', color: colors.text, flexShrink: 1 },
  barValue: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  barSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 4 },
  track: { height: 10, backgroundColor: colors.chartTrack, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },

  readout: { minHeight: 40, justifyContent: 'center', marginBottom: spacing.sm },
  readoutLabel: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  readoutValue: { fontSize: 18, color: colors.text, fontWeight: '800' },
  readoutHint: { fontSize: 12.5, color: colors.textMuted },
  axisTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  axisText: { fontSize: 10.5, color: colors.textMuted },
  gridline: { flex: 1, height: 1, backgroundColor: colors.divider },
  columns: { flexDirection: 'row', alignItems: 'flex-end' },
  columnHit: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 },
  column: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  baseline: { height: 1, backgroundColor: colors.border },
  xLabels: { height: 16, marginTop: 6 },
  xLabel: { position: 'absolute', top: 0, fontSize: 10.5, color: colors.textMuted },

  shareBar: { flexDirection: 'row', height: 16, gap: 2, borderRadius: 4, overflow: 'hidden' },
  shareSegment: { height: '100%' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '600' },
  legendPct: { fontSize: 14, color: colors.text, fontWeight: '800', width: 44, textAlign: 'right' },
  legendValue: { fontSize: 13, color: colors.textSecondary, minWidth: 96, textAlign: 'right' },
});

