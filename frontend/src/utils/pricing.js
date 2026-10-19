// Pricing rules for Bugasan ni Ali.
//
// - Rice can be ordered by kilo, half-sack (25 kg), sack (50 kg) or bulk (10 sacks / 500 kg).
// - Approved wholesale customers pay the wholesale price per kg on half-sack, sack and bulk orders.
//   Kilo orders are always retail.
// - Discount / bulk-pricing rules give a discount per cart line based on its total kilos.
//   Only the single best rule is applied to a line.

export const UNITS = {
  kilo: { key: 'kilo', label: 'Kilo', short: 'kg', kg: 1 },
  half: { key: 'half', label: 'Half-sack', short: 'half-sack', kg: 25 },
  sack: { key: 'sack', label: 'Sack', short: 'sack', kg: 50 },
  bulk: { key: 'bulk', label: 'Bulk', short: 'bulk (10 sacks)', kg: 500 },
};

export const UNIT_LIST = [UNITS.kilo, UNITS.half, UNITS.sack, UNITS.bulk];

export function unitLabel(unitKey, qty) {
  const unit = UNITS[unitKey];
  if (unitKey === 'kilo') return 'By kilo';
  if (unitKey === 'bulk') return `${qty} × bulk (${qty * 10} sacks)`;
  return `${qty} × ${unit.short}${qty > 1 ? 's' : ''}`;
}

export function isWholesaleBuyer(user) {
  return !!user && user.accountType === 'wholesale' && user.wholesaleStatus === 'approved';
}

export function getChannel(user) {
  return isWholesaleBuyer(user) ? 'wholesale' : 'retail';
}

export function getPricePerKg(product, unitKey, user) {
  const wholesale = isWholesaleBuyer(user) && unitKey !== 'kilo';
  return {
    pricePerKg: wholesale ? product.wholesalePrice : product.retailPrice,
    priceType: wholesale ? 'wholesale' : 'retail',
  };
}

export function describeRule(rule) {
  const amount = rule.type === 'percent' ? `${rule.value}% off` : `₱${rule.value} off per kg`;
  const who = rule.appliesTo === 'all' ? 'all customers' : `${rule.appliesTo} customers`;
  return { amount, condition: `${rule.minKg}+ kg per item · ${who}` };
}

export function bestRuleFor(rules, lineKg, lineSubtotal, channel) {
  let best = null;
  let bestDiscount = 0;
  rules.forEach((rule) => {
    if (!rule.active) return;
    if (lineKg < rule.minKg) return;
    if (rule.appliesTo !== 'all' && rule.appliesTo !== channel) return;
    const discount = rule.type === 'percent' ? (lineSubtotal * rule.value) / 100 : lineKg * rule.value;
    if (discount > bestDiscount) {
      best = rule;
      bestDiscount = discount;
    }
  });
  return { rule: best, discount: Math.round(bestDiscount * 100) / 100 };
}

export function priceLine(product, unitKey, qty, user, rules) {
  const lineKg = UNITS[unitKey].kg * qty;
  const { pricePerKg, priceType } = getPricePerKg(product, unitKey, user);
  const subtotal = lineKg * pricePerKg;
  const { rule, discount } = bestRuleFor(rules, lineKg, subtotal, getChannel(user));
  return {
    kg: lineKg,
    pricePerKg,
    priceType,
    subtotal,
    discount,
    ruleName: rule ? rule.name : null,
    total: subtotal - discount,
  };
}

export function computeCart(cart, products, user, rules, settings, fulfillment) {
  const lines = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return null;
      return { ...item, product, ...priceLine(product, item.unit, item.qty, user, rules) };
    })
    .filter(Boolean);

  const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const discount = lines.reduce((sum, l) => sum + l.discount, 0);
  const totalKg = lines.reduce((sum, l) => sum + l.kg, 0);
  const afterDiscount = subtotal - discount;

  let deliveryFee = 0;
  if (fulfillment === 'delivery' && lines.length > 0) {
    deliveryFee = afterDiscount >= settings.freeDeliveryMin ? 0 : settings.deliveryFee;
  }

  return {
    lines,
    subtotal,
    discount,
    deliveryFee,
    totalKg,
    total: afterDiscount + deliveryFee,
    channel: getChannel(user),
  };
}

export function stockStatus(product) {
  if (product.stockKg <= 0) return 'out';
  if (product.stockKg <= product.reorderLevel) return 'low';
  return 'ok';
}
