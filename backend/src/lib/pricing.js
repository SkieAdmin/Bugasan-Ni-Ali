// Pricing rules for Bugasan ni Ali.
// Same rules as frontend/src/utils/pricing.js. Keep the two in sync. The server's numbers are
// the ones that count: the price of an order is always computed here, never taken from the app.
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

export const SACK_KG = UNITS.sack.kg;

export const round2 = (n) => Math.round(n * 100) / 100;

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
  return { rule: best, discount: round2(bestDiscount) };
}

export function priceLine(product, unitKey, qty, user, rules) {
  const lineKg = UNITS[unitKey].kg * qty;
  const { pricePerKg, priceType } = getPricePerKg(product, unitKey, user);
  const subtotal = round2(lineKg * pricePerKg);
  const { rule, discount } = bestRuleFor(rules, lineKg, subtotal, getChannel(user));
  return {
    kg: lineKg,
    pricePerKg,
    priceType,
    subtotal,
    discount,
    ruleName: rule ? rule.name : null,
    total: round2(subtotal - discount),
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

  const subtotal = round2(lines.reduce((sum, l) => sum + l.subtotal, 0));
  const discount = round2(lines.reduce((sum, l) => sum + l.discount, 0));
  const totalKg = lines.reduce((sum, l) => sum + l.kg, 0);
  const afterDiscount = round2(subtotal - discount);

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
    total: round2(afterDiscount + deliveryFee),
    channel: getChannel(user),
  };
}

export function stockStatus(product) {
  if (product.stockKg <= 0) return 'out';
  if (product.stockKg <= product.reorderLevel) return 'low';
  return 'ok';
}
