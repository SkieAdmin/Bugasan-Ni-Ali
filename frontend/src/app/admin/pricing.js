// Admin: retail & wholesale price list, discount / bulk-pricing rules and delivery fees.
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useApp } from '../../context/AppContext';
import {
  Badge,
  Button,
  Card,
  Icon,
  InfoRow,
  Input,
  ModalSheet,
  RiceThumb,
  Screen,
  Segmented,
} from '../../components';
import { describeRule } from '../../utils/pricing';
import { peso } from '../../utils/format';
import { confirm } from '../../utils/dialog';
import { useBusy } from '../../hooks/useBusy';
import { colors, radius, spacing } from '../../theme';

const EMPTY_RULE = { name: '', minKg: '100', type: 'percent', value: '2', appliesTo: 'all' };

export default function PricingScreen() {
  const { state, actions, showToast } = useApp();
  const [tab, setTab] = useState('prices');
  const [busy, run] = useBusy();
  const [editing, setEditing] = useState(null); // product being edited
  const [priceForm, setPriceForm] = useState({ retailPrice: '', wholesalePrice: '' });
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE);
  const [delivery, setDelivery] = useState({
    deliveryFee: String(state.settings.deliveryFee),
    freeDeliveryMin: String(state.settings.freeDeliveryMin),
  });

  const openPrice = (p) => {
    setEditing(p);
    setPriceForm({ retailPrice: String(p.retailPrice), wholesalePrice: String(p.wholesalePrice) });
  };

  const savePrice = () => {
    const retail = Number(priceForm.retailPrice);
    const wholesale = Number(priceForm.wholesalePrice);
    if (!(retail > 0) || !(wholesale > 0)) {
      showToast('Enter valid prices', 'error');
      return;
    }
    if (wholesale > retail) {
      showToast('Wholesale price should not be higher than retail', 'error');
      return;
    }
    run(async () => {
      if (!(await actions.updateProduct(editing.id, { retailPrice: retail, wholesalePrice: wholesale })).ok) return;
      showToast(`${editing.name} prices updated`);
      setEditing(null);
    });
  };

  const saveRule = () => {
    const minKg = Number(ruleForm.minKg);
    const value = Number(ruleForm.value);
    if (!ruleForm.name.trim() || !(minKg > 0) || !(value > 0)) {
      showToast('Please complete the rule details', 'error');
      return;
    }
    if (ruleForm.type === 'percent' && value >= 50) {
      showToast('Percent discount must be below 50%', 'error');
      return;
    }
    run(async () => {
      if (!(await actions.addRule({ name: ruleForm.name.trim(), minKg, type: ruleForm.type, value, appliesTo: ruleForm.appliesTo })).ok) return;
      setRuleOpen(false);
      setRuleForm(EMPTY_RULE);
      showToast('Discount rule added');
    });
  };

  const removeRule = async (rule) => {
    if (await confirm('Delete rule?', `"${rule.name}" will no longer apply to orders.`, 'Delete', true)) {
      if ((await actions.deleteRule(rule.id)).ok) showToast('Rule deleted');
    }
  };

  const saveDelivery = () => {
    const fee = Number(delivery.deliveryFee);
    const min = Number(delivery.freeDeliveryMin);
    if (!(fee >= 0) || !(min >= 0)) {
      showToast('Enter valid amounts', 'error');
      return;
    }
    run(async () => {
      if ((await actions.updateSettings({ deliveryFee: fee, freeDeliveryMin: min })).ok) showToast('Delivery settings saved');
    });
  };

  return (
    <Screen>
      <Segmented
        options={[
          { value: 'prices', label: 'Price List' },
          { value: 'rules', label: 'Discounts' },
          { value: 'delivery', label: 'Delivery' },
        ]}
        value={tab}
        onChange={setTab}
        style={{ marginBottom: spacing.lg }}
      />

      {tab === 'prices' ? (
        <>
          <Text style={styles.intro}>Tap a rice variety to change its retail or wholesale price per kilo.</Text>
          <Card padded={false}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 1 }]}>Variety (per kg)</Text>
              <Text style={styles.thNum}>Retail</Text>
              <Text style={styles.thNum}>Wholesale</Text>
              <View style={styles.editSpace} />
            </View>
            {state.products.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => openPrice(p)}
                style={({ pressed }) => [styles.tr, i > 0 && styles.trBorder, pressed && { opacity: 0.7 }]}
              >
                <RiceThumb product={p} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.td} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.tdSub}>
                    Sack {peso(p.retailPrice * 50, 0)} / {peso(p.wholesalePrice * 50, 0)}
                  </Text>
                </View>
                <Text style={styles.tdNum}>{peso(p.retailPrice, 0)}</Text>
                <Text style={[styles.tdNum, { color: colors.info }]}>{peso(p.wholesalePrice, 0)}</Text>
                <Icon name="pencil-outline" size={16} color={colors.textMuted} style={styles.editSpace} />
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      {tab === 'rules' ? (
        <>
          <View style={styles.infoBox}>
            <Icon name="information-outline" size={18} color={colors.info} />
            <Text style={styles.infoText}>
              Rules are checked per item using its total kilos. If several rules match, only the biggest discount is applied.
            </Text>
          </View>
          {state.pricingRules.map((rule) => {
            const d = describeRule(rule);
            return (
              <Card key={rule.id} style={[styles.rule, !rule.active && { opacity: 0.6 }]}>
                <View style={styles.ruleTop}>
                  <View style={styles.ruleIcon}>
                    <Icon name={rule.type === 'percent' ? 'percent-outline' : 'tag-outline'} size={20} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleName}>{rule.name}</Text>
                    <Text style={styles.ruleAmount}>{d.amount}</Text>
                    <Text style={styles.ruleCond}>{d.condition}</Text>
                  </View>
                  <Switch
                    value={rule.active}
                    onValueChange={(v) => actions.updateRule(rule.id, { active: v })}
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor={colors.white}
                  />
                </View>
                <View style={styles.ruleBottom}>
                  <Badge label={rule.active ? 'Active' : 'Inactive'} tone={rule.active ? 'success' : 'neutral'} />
                  <Button title="Delete" variant="ghost" size="sm" icon="trash-can-outline" onPress={() => removeRule(rule)} />
                </View>
              </Card>
            );
          })}
          <Button title="Add Discount Rule" icon="plus" variant="outline" onPress={() => setRuleOpen(true)} />
        </>
      ) : null}

      {tab === 'delivery' ? (
        <Card>
          <Input
            label="Delivery fee (₱)"
            keyboardType="decimal-pad"
            value={delivery.deliveryFee}
            onChangeText={(t) => setDelivery({ ...delivery, deliveryFee: t })}
          />
          <Input
            label="Free delivery for orders of at least (₱)"
            keyboardType="decimal-pad"
            value={delivery.freeDeliveryMin}
            onChangeText={(t) => setDelivery({ ...delivery, freeDeliveryMin: t })}
          />
          <InfoRow label="Current" value={`${peso(state.settings.deliveryFee, 0)} · free at ${peso(state.settings.freeDeliveryMin, 0)}+`} />
          <Button title="Save Delivery Settings" icon="content-save-outline" onPress={saveDelivery} loading={busy} style={{ marginTop: spacing.md }} />
        </Card>
      ) : null}

      <ModalSheet
        visible={!!editing}
        title={editing ? editing.name : ''}
        onClose={() => setEditing(null)}
        footer={<Button title="Save Prices" icon="content-save-outline" onPress={savePrice} loading={busy} />}
      >
        <Input label="Retail price per kg (₱)" keyboardType="decimal-pad" value={priceForm.retailPrice} onChangeText={(t) => setPriceForm({ ...priceForm, retailPrice: t })} />
        <Input
          label="Wholesale price per kg (₱)"
          keyboardType="decimal-pad"
          value={priceForm.wholesalePrice}
          onChangeText={(t) => setPriceForm({ ...priceForm, wholesalePrice: t })}
          hint={editing ? `Cost price: ${peso(editing.costPerKg)}/kg` : undefined}
        />
      </ModalSheet>

      <ModalSheet visible={ruleOpen} title="New discount rule" onClose={() => setRuleOpen(false)} footer={<Button title="Save Rule" icon="content-save-outline" onPress={saveRule} loading={busy} />}>
        <Input label="Rule name" placeholder="e.g. Fiesta Bulk Promo" value={ruleForm.name} onChangeText={(t) => setRuleForm({ ...ruleForm, name: t })} />
        <Text style={styles.label}>Discount type</Text>
        <Segmented
          options={[
            { value: 'percent', label: '% off' },
            { value: 'perKg', label: '₱ off per kg' },
          ]}
          value={ruleForm.type}
          onChange={(v) => setRuleForm({ ...ruleForm, type: v })}
          style={{ marginBottom: spacing.md }}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Input
            label={ruleForm.type === 'percent' ? 'Discount (%)' : 'Discount (₱/kg)'}
            keyboardType="decimal-pad"
            value={ruleForm.value}
            onChangeText={(t) => setRuleForm({ ...ruleForm, value: t })}
            style={{ flex: 1 }}
          />
          <Input
            label="Minimum kg per item"
            keyboardType="number-pad"
            value={ruleForm.minKg}
            onChangeText={(t) => setRuleForm({ ...ruleForm, minKg: t })}
            style={{ flex: 1 }}
          />
        </View>
        <Text style={styles.label}>Applies to</Text>
        <Segmented
          options={[
            { value: 'all', label: 'Everyone' },
            { value: 'retail', label: 'Retail' },
            { value: 'wholesale', label: 'Wholesale' },
          ]}
          value={ruleForm.appliesTo}
          onChange={(v) => setRuleForm({ ...ruleForm, appliesTo: v })}
        />
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  tableHead: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: spacing.sm },
  th: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  thNum: { width: 64, fontSize: 12, fontWeight: '700', color: colors.textMuted, textAlign: 'right' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  trBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  td: { fontSize: 14, fontWeight: '700', color: colors.text },
  tdSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  tdNum: { width: 64, fontSize: 14, fontWeight: '800', color: colors.text, textAlign: 'right' },
  editSpace: { width: 16 },
  infoBox: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.infoLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg },
  infoText: { flex: 1, fontSize: 12.5, color: colors.info, lineHeight: 18 },
  rule: { marginBottom: spacing.md },
  ruleTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ruleIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  ruleName: { fontSize: 15, fontWeight: '800', color: colors.text },
  ruleAmount: { fontSize: 14, fontWeight: '700', color: colors.success, marginTop: 1 },
  ruleCond: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  ruleBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
});
